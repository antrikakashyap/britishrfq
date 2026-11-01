import { EventEmitter } from 'node:events';
import type { Db } from './db.js';
import { AppError } from './errors.js';
import { LIMITS } from './limits.js';
import { evalExtension, type ExtResult } from './domain/extension.js';
import { fromCents, toCents } from './domain/money.js';
import { byPrice, rankBids, rankLabel, type BidLite, type RankRow } from './domain/ranking.js';
import { statusAt } from './domain/status.js';
import { MIN_MS, TRIGGER_LABEL, type Clock, type Status, type TrigType } from './domain/types.js';
import {
  bidSchema,
  createSchema,
  fieldErrors,
  timelineErrors,
  type BidInput,
  type CreateInput,
} from './domain/validation.js';

/* ------------------------------------------------------------------ rows */

interface Rfq {
  id: number;
  refId: string;
  name: string;
  description: string | null;
  currency: string;
  pickupMs: number;
  startMs: number;
  closeMs: number;
  origMs: number;
  forcedMs: number;
  winMin: number;
  extMin: number;
  trig: TrigType;
  status: Status;
  extCount: number;
  createdMs: number;
  closedMs: number | null;
}

interface BidRow extends BidLite {
  name: string;
  fr: number;
  og: number;
  ds: number;
  tr: number;
  vd: number;
}

const RFQ_COLS = `id, ref_id AS refId, name, description, currency, pickup_ms AS pickupMs,
  bid_start_ms AS startMs, bid_close_ms AS closeMs, orig_close_ms AS origMs, forced_close_ms AS forcedMs,
  trigger_window_min AS winMin, extension_min AS extMin, trigger_type AS trig, status,
  extension_count AS extCount, created_ms AS createdMs, closed_ms AS closedMs`;

const BID_COLS = `b.id, b.supplier_id AS supId, s.name AS name, b.freight_cents AS fr, b.origin_cents AS og,
  b.destination_cents AS ds, b.total_cents AS total, b.transit_days AS tr, b.validity_days AS vd,
  b.created_ms AS atMs`;

/** Domain events pushed to the live (SSE) channel. */
export interface LiveEvent {
  type: 'created' | 'bid' | 'extended' | 'status';
  rfqId: number;
  refId: string;
}

const iso = (ms: number): string => new Date(ms).toISOString();
const money = (cents: number, cur: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(fromCents(cents));

/* --------------------------------------------------------------- service */

export class AuctionService {
  readonly bus = new EventEmitter();
  private depth = 0;

  constructor(
    private readonly db: Db,
    readonly now: Clock = Date.now,
  ) {
    this.bus.setMaxListeners(0);
  }

  /* ---------- tiny helpers ---------- */

  private all<T>(sql: string, ...p: (string | number | null)[]): T[] {
    return this.db.prepare(sql).all(...p) as unknown as T[];
  }
  private one<T>(sql: string, ...p: (string | number | null)[]): T | undefined {
    return this.db.prepare(sql).get(...p) as unknown as T | undefined;
  }
  private run(sql: string, ...p: (string | number | null)[]): number {
    return Number(this.db.prepare(sql).run(...p).lastInsertRowid);
  }

  /** Re-entrant IMMEDIATE transaction: takes the write lock up-front so a bid is atomic. */
  private tx<T>(fn: () => T): T {
    if (this.depth > 0) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.depth++;
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      this.depth--;
    }
  }

  private emit(type: LiveEvent['type'], r: Pick<Rfq, 'id' | 'refId'>): void {
    this.bus.emit('event', { type, rfqId: r.id, refId: r.refId } satisfies LiveEvent);
  }

  private log(
    rfqId: number,
    kind: string,
    message: string,
    at: number,
    x: { reason?: string; supId?: number; bidId?: number; oldMs?: number; newMs?: number } = {},
  ): void {
    this.run(
      `INSERT INTO activity_log (rfq_id, kind, message, reason, supplier_id, bid_id, old_close_ms, new_close_ms, created_ms)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      rfqId, kind, message, x.reason ?? null, x.supId ?? null, x.bidId ?? null, x.oldMs ?? null, x.newMs ?? null, at,
    );
  }

  private find(key: string): Rfq {
    const r =
      this.one<Rfq>(`SELECT ${RFQ_COLS} FROM rfqs WHERE ref_id = ?`, key) ??
      (/^\d+$/.test(key) ? this.one<Rfq>(`SELECT ${RFQ_COLS} FROM rfqs WHERE id = ?`, Number(key)) : undefined);
    if (!r) throw new AppError('NOT_FOUND', 404, `RFQ "${key}" was not found`);
    return r;
  }

  private bidsOf(rfqId: number): BidRow[] {
    return this.all<BidRow>(
      `SELECT ${BID_COLS} FROM bids b JOIN suppliers s ON s.id = b.supplier_id WHERE b.rfq_id = ?`,
      rfqId,
    );
  }

  /** Each supplier's best bid only (one row per supplier): all that ranking needs, O(suppliers) not O(bids). */
  private bestOf(rfqId: number): BidRow[] {
    return this.all<BidRow>(
      `SELECT ${BID_COLS} FROM bids b JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.rfq_id = ? AND b.id = (
         SELECT b2.id FROM bids b2 WHERE b2.rfq_id = b.rfq_id AND b2.supplier_id = b.supplier_id
         ORDER BY b2.total_cents, b2.created_ms, b2.id LIMIT 1)`,
      rfqId,
    );
  }

  /* ------------------------------------------------------ lifecycle */

  /**
   * Persist any lifecycle transition that time alone has caused
   * (SCHEDULED -> ACTIVE -> CLOSED / FORCE_CLOSED) and write the matching log lines.
   * Idempotent. Log lines carry the LOGICAL time of the event (start / close time), not "now".
   */
  private settleRow(r: Rfq, now: number): Rfq {
    const want = statusAt(r, now);
    if (want === r.status) return r;
    const out = this.tx(() => {
      if (r.status === 'SCHEDULED') this.log(r.id, 'AUCTION_STARTED', 'Bidding opened', r.startMs);
      let closedMs: number | null = null;
      if (want === 'CLOSED' || want === 'FORCE_CLOSED') {
        closedMs = r.closeMs;
        const bids = this.bestOf(r.id);
        const top = rankBids(bids)[0];
        const who = top ? ` Winning bid: ${bids.find((b) => b.id === top.id)?.name} at ${money(top.total, r.currency)} (L1).` : ' No bids were received.';
        if (want === 'FORCE_CLOSED')
          this.log(r.id, 'AUCTION_FORCE_CLOSED', `Auction force-closed at the Forced Bid Close time.${who}`, r.closeMs, {
            reason: 'Extensions reached the Forced Bid Close time; no further extension is possible.',
          });
        else this.log(r.id, 'AUCTION_CLOSED', `Auction closed.${who}`, r.closeMs);
      }
      this.run('UPDATE rfqs SET status = ?, closed_ms = ? WHERE id = ?', want, closedMs, r.id);
      return { ...r, status: want, closedMs };
    });
    this.emit('status', r);
    return out;
  }

  /** Called by the background sweeper (and on reads) so statuses never go stale. */
  settleAll(): number {
    const now = this.now();
    let n = 0;
    for (const r of this.all<Rfq>(`SELECT ${RFQ_COLS} FROM rfqs WHERE status IN ('SCHEDULED','ACTIVE')`)) {
      if (this.settleRow(r, now) !== r) n++;
    }
    return n;
  }

  /* --------------------------------------------------------- create */

  createRfq(raw: unknown): ReturnType<AuctionService['details']> {
    const p = createSchema.safeParse(raw);
    if (!p.success) throw new AppError('VALIDATION_ERROR', 422, 'Please fix the highlighted fields', fieldErrors(p.error));
    const v: CreateInput = p.data;
    const now = this.now();
    const errs = timelineErrors(v, now);
    if (Object.keys(errs).length) throw new AppError('VALIDATION_ERROR', 422, 'Please fix the highlighted fields', errs);
    if (this.one('SELECT 1 AS x FROM rfqs WHERE ref_id = ?', v.refId))
      throw new AppError('DUPLICATE_REF', 409, `An RFQ with reference "${v.refId}" already exists`, {
        refId: ['This reference ID is already in use'],
      });

    const id = this.tx(() => {
      const rid = this.run(
        `INSERT INTO rfqs (ref_id, name, description, currency, pickup_ms, bid_start_ms, bid_close_ms, orig_close_ms,
           forced_close_ms, trigger_window_min, extension_min, trigger_type, status, created_ms)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'SCHEDULED', ?)`,
        v.refId, v.name, v.description || null, v.currency, v.pickupDate, v.bidStart, v.bidClose, v.bidClose,
        v.forcedBidClose, v.triggerWindowMin, v.extensionMin, v.triggerType, now,
      );
      this.log(
        rid, 'RFQ_CREATED',
        `RFQ created with British Auction enabled (X = ${v.triggerWindowMin} min, Y = ${v.extensionMin} min)`,
        now,
        { reason: TRIGGER_LABEL[v.triggerType].replace('X', String(v.triggerWindowMin)) },
      );
      return rid;
    });
    const r = this.find(String(id));
    this.settleRow(r, now);
    this.emit('created', r);
    return this.details(String(id));
  }

  /* ------------------------------------------------------------ bid */

  placeBid(key: string, raw: unknown) {
    const p = bidSchema.safeParse(raw);
    if (!p.success) throw new AppError('VALIDATION_ERROR', 422, 'Please fix the highlighted fields', fieldErrors(p.error));
    const v: BidInput = p.data;

    // persist any time-driven transition first (own transaction) ...
    const r0 = this.find(key);
    this.settleRow(r0, this.now());

    // ... then the bid itself: validate + insert + evaluate extension, atomically.
    const res = this.tx(() => {
      const now = this.now(); // ONE server-side timestamp decides everything about this bid
      const r = this.find(String(r0.id));
      const st = statusAt(r, now);
      if (st === 'SCHEDULED')
        throw new AppError('AUCTION_NOT_STARTED', 409, `Bidding for ${r.refId} has not started yet`);
      if (st !== 'ACTIVE')
        throw new AppError('AUCTION_CLOSED', 409, `Bidding for ${r.refId} has closed - no more bids are accepted`);

      const nm = v.carrierName.replace(/\s+/g, ' ');
      const sid = this.upsertSupplier(nm, now);
      const tot = toCents(v.freightCharges) + toCents(v.originCharges) + toCents(v.destinationCharges);
      const prev = this.one<{ t: number | null }>(
        'SELECT MIN(total_cents) AS t FROM bids WHERE rfq_id = ? AND supplier_id = ?', r.id, sid,
      );
      if (prev?.t != null && tot >= prev.t)
        throw new AppError(
          'BID_NOT_LOWER', 422,
          `Your new total (${money(tot, r.currency)}) must be lower than your current bid (${money(prev.t, r.currency)})`,
          { freightCharges: ['Must be lower than your last bid'] },
        );

      const old = this.bestOf(r.id);
      const before = rankBids(old);
      const bid = this.run(
        `INSERT INTO bids (rfq_id, supplier_id, freight_cents, origin_cents, destination_cents, transit_days, validity_days, created_ms)
         VALUES (?,?,?,?,?,?,?,?)`,
        r.id, sid, toCents(v.freightCharges), toCents(v.originCharges), toCents(v.destinationCharges),
        v.transitTimeDays, v.quoteValidityDays, now,
      );
      const row: BidLite = { id: bid, supId: sid, total: tot, atMs: now };
      const after = rankBids([...old, row]);
      const mine = after.find((x) => x.id === bid) ?? after.find((x) => x.supId === sid)!;

      this.log(
        r.id, 'BID_SUBMITTED',
        `${nm} submitted a bid of ${money(tot, r.currency)} - now ${rankLabel(mine.rank)}`,
        now, { supId: sid, bidId: bid },
      );

      const ext = evalExtension({
        trig: r.trig, winMin: r.winMin, extMin: r.extMin, closeMs: r.closeMs, forcedMs: r.forcedMs,
        nowMs: now, before, after,
      });
      this.applyExtension(r, ext, nm, sid, bid, before, after, old, now);
      return { r, ext, bid, rank: mine.rank, sup: after.length };
    });

    const fresh = this.find(String(res.r.id));
    this.emit('bid', fresh);
    if (res.ext.outcome === 'EXTENDED' || res.ext.outcome === 'CAPPED') this.emit('extended', fresh);
    return {
      bidId: res.bid,
      rank: res.rank,
      rankLabel: rankLabel(res.rank),
      suppliers: res.sup,
      extension: {
        outcome: res.ext.outcome,
        extended: res.ext.outcome === 'EXTENDED' || res.ext.outcome === 'CAPPED',
        previousClose: iso(res.r.closeMs),
        newClose: iso(res.ext.newCloseMs),
      },
      auction: this.details(String(res.r.id)),
    };
  }

  private upsertSupplier(name: string, now: number): number {
    const key = name.toLowerCase();
    this.run('INSERT INTO suppliers (name, name_key, created_ms) VALUES (?,?,?) ON CONFLICT(name_key) DO NOTHING', name, key, now);
    return this.one<{ id: number }>('SELECT id FROM suppliers WHERE name_key = ?', key)!.id;
  }

  /** Writes the extension (if any) and its human-readable reason to rfqs + activity_log. */
  private applyExtension(
    r: Rfq, ext: ExtResult, name: string, sid: number, bid: number,
    before: RankRow[], after: RankRow[], old: BidRow[], now: number,
  ): void {
    if (ext.outcome === 'NONE') return;
    const names = new Map(old.map((b) => [b.supId, b.name]));
    const why = this.reasonText(r, name, sid, before, after, names);
    const x = { reason: why, supId: sid, bidId: bid, oldMs: r.closeMs, newMs: ext.newCloseMs };
    if (ext.outcome === 'BLOCKED') {
      this.log(
        r.id, 'EXTENSION_BLOCKED',
        'Extension trigger fired but the auction is already at its Forced Bid Close time - no extension granted',
        now, { ...x, newMs: r.closeMs },
      );
      return;
    }
    const added = Math.round((ext.newCloseMs - r.closeMs) / MIN_MS);
    this.run('UPDATE rfqs SET bid_close_ms = ?, extension_count = extension_count + 1 WHERE id = ?', ext.newCloseMs, r.id);
    if (ext.outcome === 'CAPPED')
      this.log(
        r.id, 'EXTENSION_CAPPED',
        `Auction extended by ${added} min (capped at the Forced Bid Close time; ${r.extMin} min were requested)`,
        now, x,
      );
    else this.log(r.id, 'TIME_EXTENDED', `Auction extended by ${added} min`, now, x);
  }

  private reasonText(
    r: Rfq, name: string, sid: number, before: RankRow[], after: RankRow[], names: Map<number, string>,
  ): string {
    const w = `in the last ${r.winMin} min before close`;
    const mine = after.find((a) => a.supId === sid)!;
    const was = before.find((b) => b.supId === sid);
    if (r.trig === 'BID_RECEIVED') return `Trigger "Bid received in last X minutes": a bid from ${name} arrived ${w}`;
    if (r.trig === 'ANY_RANK_CHANGE')
      return `Trigger "Any supplier rank change in last X minutes": ${
        was ? `${name} moved from ${rankLabel(was.rank)} to ${rankLabel(mine.rank)}` : `${name} entered the ranking at ${rankLabel(mine.rank)}`
      }, re-ordering the suppliers ${w}`;
    const prevTop = before[0] ? names.get(before[0].supId) : undefined;
    return `Trigger "Lowest bidder (L1) rank change in last X minutes": ${name} became the lowest bidder (L1)${
      prevTop ? `, replacing ${prevTop}` : ' (first bid placed)'
    } ${w}`;
  }

  /* ---------------------------------------------------------- reads */

  list(opts: { status?: string; q?: string } = {}) {
    this.settleAll();
    const rows = this.all<Rfq & { bidCount: number; supCount: number; lowTotal: number | null; lowName: string | null }>(
      `SELECT ${RFQ_COLS},
        (SELECT COUNT(*) FROM bids b WHERE b.rfq_id = rfqs.id) AS bidCount,
        (SELECT COUNT(DISTINCT supplier_id) FROM bids b WHERE b.rfq_id = rfqs.id) AS supCount,
        (SELECT total_cents FROM bids b WHERE b.rfq_id = rfqs.id ORDER BY total_cents, created_ms, id LIMIT 1) AS lowTotal,
        (SELECT s.name FROM bids b JOIN suppliers s ON s.id = b.supplier_id WHERE b.rfq_id = rfqs.id
           ORDER BY b.total_cents, b.created_ms, b.id LIMIT 1) AS lowName
       FROM rfqs`,
    );
    const q = opts.q?.trim().toLowerCase().slice(0, LIMITS.searchMax);
    const wt = (s: Status) => (s === 'ACTIVE' ? 0 : s === 'SCHEDULED' ? 1 : 2);
    return rows
      .filter((r) => !opts.status || opts.status === 'ALL' || r.status === opts.status)
      .filter((r) => !q || r.refId.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      .sort((a, b) => wt(a.status) - wt(b.status) || (wt(a.status) === 2 ? b.closeMs - a.closeMs : a.closeMs - b.closeMs))
      .map((r) => ({
        id: r.id,
        refId: r.refId,
        name: r.name,
        currency: r.currency,
        status: r.status,
        lowestBid: r.lowTotal == null ? null : { total: fromCents(r.lowTotal), carrierName: r.lowName! },
        bidCount: r.bidCount,
        supplierCount: r.supCount,
        bidStart: iso(r.startMs),
        bidClose: iso(r.closeMs),
        originalBidClose: iso(r.origMs),
        forcedBidClose: iso(r.forcedMs),
        extensionCount: r.extCount,
        config: this.cfg(r),
      }));
  }

  private cfg(r: Rfq) {
    return {
      triggerWindowMin: r.winMin,
      extensionMin: r.extMin,
      triggerType: r.trig,
      triggerLabel: TRIGGER_LABEL[r.trig].replace('X', String(r.winMin)),
    };
  }

  /**
   * Full auction view. `bids` caps the "all bids by price" table (default 200, "all" = no cap) and
   * activity is capped to the newest 300 lines, so the payload stays small however busy the auction is.
   * Ranking, counts and the price history are always complete.
   */
  details(key: string, opts: { bids?: number | 'all' } = {}) {
    let r = this.find(key);
    const now = this.now();
    r = this.settleRow(r, now);
    const best = this.bestOf(r.id);
    const rank = rankBids(best);
    const rk = new Map(rank.map((x) => [x.supId, x.rank]));
    const cur = new Set(rank.map((x) => x.id));
    const per = new Map(
      this.all<{ sid: number; n: number }>('SELECT supplier_id AS sid, COUNT(*) AS n FROM bids WHERE rfq_id = ? GROUP BY supplier_id', r.id).map((x) => [x.sid, x.n]),
    );
    const total = this.one<{ n: number }>('SELECT COUNT(*) AS n FROM bids WHERE rfq_id = ?', r.id)!.n;
    const cap = opts.bids === 'all' ? -1 : Math.min(Math.max(opts.bids ?? LIMITS.bidsDefault, 1), LIMITS.bidsMax);
    const rows = this.all<BidRow>(
      `SELECT ${BID_COLS} FROM bids b JOIN suppliers s ON s.id = b.supplier_id WHERE b.rfq_id = ?
       ORDER BY b.total_cents, b.created_ms, b.id LIMIT ?`,
      r.id, cap,
    );
    const hist = this.all<{ name: string; total: number; atMs: number }>(
      `SELECT s.name AS name, b.total_cents AS total, b.created_ms AS atMs FROM bids b JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.rfq_id = ? ORDER BY b.created_ms DESC, b.id DESC LIMIT ${LIMITS.historyCap}`,
      r.id,
    ).reverse();

    const dto = (b: BidRow) => ({
      bidId: b.id,
      carrierName: b.name,
      total: fromCents(b.total),
      freightCharges: fromCents(b.fr),
      originCharges: fromCents(b.og),
      destinationCharges: fromCents(b.ds),
      transitTimeDays: b.tr,
      quoteValidityDays: b.vd,
      validUntil: iso(b.atMs + b.vd * 86_400_000),
      submittedAt: iso(b.atMs),
    });
    const topId = rank[0]?.id;
    const logTotal = this.one<{ n: number }>('SELECT COUNT(*) AS n FROM activity_log WHERE rfq_id = ?', r.id)!.n;
    const logs = this.all<{
      id: number; kind: string; message: string; reason: string | null; name: string | null;
      oldMs: number | null; newMs: number | null; at: number;
    }>(
      `SELECT l.id, l.kind, l.message, l.reason, s.name AS name, l.old_close_ms AS oldMs, l.new_close_ms AS newMs, l.created_ms AS at
       FROM activity_log l LEFT JOIN suppliers s ON s.id = l.supplier_id WHERE l.rfq_id = ?
       ORDER BY l.created_ms DESC, l.id DESC LIMIT ${LIMITS.activityCap}`,
      r.id,
    ).reverse();
    const low = rank[0] ? best.find((b) => b.id === rank[0]!.id)! : undefined;
    return {
      serverTime: iso(now),
      auction: {
        id: r.id,
        refId: r.refId,
        name: r.name,
        description: r.description,
        currency: r.currency,
        status: r.status,
        pickupDate: iso(r.pickupMs),
        bidStart: iso(r.startMs),
        bidClose: iso(r.closeMs),
        originalBidClose: iso(r.origMs),
        forcedBidClose: iso(r.forcedMs),
        extensionCount: r.extCount,
        totalExtendedMin: Math.round((r.closeMs - r.origMs) / MIN_MS),
        bidCount: total,
        supplierCount: rank.length,
        lowestBid: low ? { total: fromCents(low.total), carrierName: low.name } : null,
        config: this.cfg(r),
      },
      ranking: rank.map((x) => {
        const b = best.find((y) => y.id === x.id)!;
        return { rank: x.rank, label: rankLabel(x.rank), ...dto(b), bidsPlaced: per.get(x.supId) ?? 1, isLowest: x.id === topId };
      }),
      bids: rows.map((b) => ({ ...dto(b), supplierRank: rk.get(b.supId)!, isCurrent: cur.has(b.id) })),
      bidsTotal: total,
      history: hist.map((h) => ({ carrierName: h.name, total: fromCents(h.total), submittedAt: iso(h.atMs) })),
      activity: logs.map((l) => ({
        id: l.id,
        kind: l.kind,
        message: l.message,
        reason: l.reason,
        carrierName: l.name,
        previousClose: l.oldMs == null ? null : iso(l.oldMs),
        newClose: l.newMs == null ? null : iso(l.newMs),
        at: iso(l.at),
      })),
      activityTotal: logTotal,
    };
  }

  /* -------------------------------------------------------- metrics */

  /** Section 4 "Success Metrics": bids per RFQ and price improvement, extended vs non-extended. */
  metrics() {
    this.settleAll();
    const rs = this.all<Rfq>(`SELECT ${RFQ_COLS} FROM rfqs`);
    const cnt = (s: Status) => rs.filter((r) => r.status === s).length;
    const done = rs.filter((r) => r.status === 'CLOSED' || r.status === 'FORCE_CLOSED');
    const per = (r: Rfq) => {
      const bs = this.all<{ t: number; at: number }>('SELECT total_cents AS t, created_ms AS at FROM bids WHERE rfq_id = ?', r.id);
      const fin = bs.length ? Math.min(...bs.map((b) => b.t)) : null;
      const pre = bs.filter((b) => b.at < r.origMs).map((b) => b.t);
      const atOrig = pre.length ? Math.min(...pre) : null;
      return { n: bs.length, fin, atOrig };
    };
    const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : null);
    const ext = done.filter((r) => r.extCount > 0).map((r) => ({ r, ...per(r) }));
    const plain = done.filter((r) => r.extCount === 0).map((r) => ({ r, ...per(r) }));
    const gain = ext
      .filter((e) => e.atOrig != null && e.fin != null && e.atOrig > 0)
      .map((e) => ((e.atOrig! - e.fin!) / e.atOrig!) * 100);
    const allBids = rs.reduce((s, r) => s + per(r).n, 0);
    return {
      auctions: { total: rs.length, scheduled: cnt('SCHEDULED'), active: cnt('ACTIVE'), closed: cnt('CLOSED'), forceClosed: cnt('FORCE_CLOSED') },
      bids: { total: allBids, avgPerRfq: rs.length ? Math.round((allBids / rs.length) * 10) / 10 : 0 },
      extensions: {
        total: rs.reduce((s, r) => s + r.extCount, 0),
        auctionsExtended: rs.filter((r) => r.extCount > 0).length,
        extraMinutesGranted: rs.reduce((s, r) => s + Math.round((r.closeMs - r.origMs) / MIN_MS), 0),
      },
      comparison: {
        extended: { auctions: ext.length, avgBidsPerRfq: avg(ext.map((e) => e.n)), avgPriceImprovementPct: avg(gain) },
        nonExtended: { auctions: plain.length, avgBidsPerRfq: avg(plain.map((e) => e.n)) },
      },
    };
  }
}
