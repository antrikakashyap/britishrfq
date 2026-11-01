import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import { seedDemo } from '../src/seed.js';
import { at, bidBody, isoAt, mkSvc, rfqBody } from './helpers.js';

const code = (f: () => unknown): string | undefined => {
  try {
    f();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
};

function setup(o: Record<string, unknown> = {}) {
  const k = mkSvc(at(9));
  k.svc.createRfq(rfqBody(o));
  k.set(at(10, 30)); // bidding is open
  return k;
}

describe('RFQ creation & lifecycle', () => {
  it('creates a SCHEDULED auction, opens it on time and logs both events', () => {
    const k = mkSvc(at(9));
    const d = k.svc.createRfq(rfqBody());
    expect(d.auction.status).toBe('SCHEDULED');
    k.set(at(10, 1));
    const d2 = k.svc.details('RFQ-T-1');
    expect(d2.auction.status).toBe('ACTIVE');
    expect(d2.activity.map((a) => a.kind)).toEqual(['RFQ_CREATED', 'AUCTION_STARTED']);
  });

  it('enforces the spec validation rules with field-level errors', () => {
    const k = mkSvc(at(9));
    let err: AppError | undefined;
    try {
      k.svc.createRfq(rfqBody({ forcedBidClose: isoAt(18) })); // == close
    } catch (e) {
      err = e as AppError;
    }
    expect(err?.code).toBe('VALIDATION_ERROR');
    expect(err?.fields?.['forcedBidClose']?.[0]).toMatch(/later than bid close/);
    expect(code(() => k.svc.createRfq(rfqBody({ forcedBidClose: isoAt(17) })))).toBe('VALIDATION_ERROR');
    expect(code(() => k.svc.createRfq(rfqBody({ bidClose: '2026-11-05T18:00:00' })))).toBe('VALIDATION_ERROR'); // no timezone
    expect(code(() => k.svc.createRfq(rfqBody({ triggerWindowMin: 0 })))).toBe('VALIDATION_ERROR');
    expect(code(() => k.svc.createRfq({}))).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate reference ID (case-insensitive)', () => {
    const k = setup();
    expect(code(() => k.svc.createRfq(rfqBody({ refId: 'rfq-t-1' })))).toBe('DUPLICATE_REF');
  });
});

describe('bidding rules', () => {
  it('rejects bids before start and after close', () => {
    const k = mkSvc(at(9));
    k.svc.createRfq(rfqBody());
    expect(code(() => k.svc.placeBid('RFQ-T-1', bidBody('A', 100)))).toBe('AUCTION_NOT_STARTED');
    k.set(at(18));
    expect(code(() => k.svc.placeBid('RFQ-T-1', bidBody('A', 100)))).toBe('AUCTION_CLOSED'); // exactly at close
  });

  it('requires each supplier to lower its own total; names are case/space-insensitive', () => {
    const k = setup();
    k.svc.placeBid('RFQ-T-1', bidBody('Maersk Line', 1000));
    expect(code(() => k.svc.placeBid('RFQ-T-1', bidBody('maersk  LINE', 1000)))).toBe('BID_NOT_LOWER');
    expect(code(() => k.svc.placeBid('RFQ-T-1', bidBody('Maersk Line', 1200)))).toBe('BID_NOT_LOWER');
    expect(k.svc.placeBid('RFQ-T-1', bidBody('MAERSK line', 999.99)).rank).toBe(1);
    expect(k.svc.details('RFQ-T-1').auction.supplierCount).toBe(1);
  });

  it('a rejected bid leaves no trace (atomic)', () => {
    const k = setup();
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    const n = k.svc.details('RFQ-T-1').activity.length;
    code(() => k.svc.placeBid('RFQ-T-1', bidBody('A', 2000)));
    const d = k.svc.details('RFQ-T-1');
    expect(d.activity.length).toBe(n);
    expect(d.auction.bidCount).toBe(1);
  });

  it('ranks suppliers by total (L1, L2, ...) and sorts bids by price', () => {
    const k = setup();
    k.svc.placeBid('RFQ-T-1', bidBody('A', 900));
    k.svc.placeBid('RFQ-T-1', bidBody('B', 700));
    k.svc.placeBid('RFQ-T-1', bidBody('C', 800));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 750));
    const d = k.svc.details('RFQ-T-1');
    expect(d.ranking.map((r) => [r.label, r.carrierName, r.total])).toEqual([['L1', 'B', 700], ['L2', 'A', 750], ['L3', 'C', 800]]);
    expect(d.bids.map((b) => b.total)).toEqual([700, 750, 800, 900]);
    expect(d.ranking[1]).toMatchObject({ bidsPlaced: 2, freightCharges: 600, transitTimeDays: 20, quoteValidityDays: 14 });
    expect(d.auction.lowestBid).toEqual({ total: 700, carrierName: 'B' });
  });
});

describe('British auction - extensions (close 18:00, X = 10, Y = 5)', () => {
  it('bid received in the last X minutes extends 18:00 -> 18:05, outside it does not', () => {
    const k = setup();
    k.set(at(17, 49));
    expect(k.svc.placeBid('RFQ-T-1', bidBody('A', 1000)).extension.extended).toBe(false);
    k.set(at(17, 55));
    const r = k.svc.placeBid('RFQ-T-1', bidBody('B', 990));
    expect(r.extension).toMatchObject({ outcome: 'EXTENDED', previousClose: isoAt(18), newClose: isoAt(18, 5) });
    const d = r.auction;
    expect(d.auction.bidClose).toBe(isoAt(18, 5));
    expect(d.auction.originalBidClose).toBe(isoAt(18));
    expect(d.auction.extensionCount).toBe(1);
    const ex = d.activity.find((a) => a.kind === 'TIME_EXTENDED')!;
    expect(ex).toMatchObject({ previousClose: isoAt(18), newClose: isoAt(18, 5), carrierName: 'B' });
    expect(ex.reason).toMatch(/Bid received in last X minutes/);
  });

  it('ANY_RANK_CHANGE: reorder extends, a price drop that keeps the order does not', () => {
    const k = setup({ triggerType: 'ANY_RANK_CHANGE' });
    k.set(at(12));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    k.svc.placeBid('RFQ-T-1', bidBody('B', 1100));
    k.set(at(17, 56));
    expect(k.svc.placeBid('RFQ-T-1', bidBody('B', 1050)).extension.extended).toBe(false); // still L2
    k.set(at(17, 58));
    const r = k.svc.placeBid('RFQ-T-1', bidBody('B', 950)); // B overtakes A
    expect(r.extension.extended).toBe(true);
    expect(r.auction.activity.at(-1)?.reason).toMatch(/B moved from L2 to L1/);
  });

  it('L1_CHANGE: only a new lowest bidder extends', () => {
    const k = setup({ triggerType: 'L1_CHANGE' });
    k.set(at(12));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    k.svc.placeBid('RFQ-T-1', bidBody('B', 1100));
    k.svc.placeBid('RFQ-T-1', bidBody('C', 1200));
    k.set(at(17, 57));
    expect(k.svc.placeBid('RFQ-T-1', bidBody('C', 1050)).extension.extended).toBe(false); // C: L3 -> L2
    k.set(at(17, 59));
    const r = k.svc.placeBid('RFQ-T-1', bidBody('B', 900)); // B becomes L1
    expect(r.extension).toMatchObject({ extended: true, newClose: isoAt(18, 5) });
    expect(r.auction.activity.at(-1)?.reason).toMatch(/B became the lowest bidder \(L1\), replacing A/);
  });

  it('keeps extending, but NEVER beyond the Forced Bid Close (18:12)', () => {
    const k = setup({ forcedBidClose: isoAt(18, 12) });
    const close = () => k.svc.details('RFQ-T-1').auction.bidClose;
    k.set(at(17, 55));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    expect(close()).toBe(isoAt(18, 5));
    k.set(at(18, 3));
    k.svc.placeBid('RFQ-T-1', bidBody('B', 990));
    expect(close()).toBe(isoAt(18, 10));
    k.set(at(18, 8));
    const cap = k.svc.placeBid('RFQ-T-1', bidBody('C', 980)); // 18:15 requested -> clipped to 18:12
    expect(cap.extension).toMatchObject({ outcome: 'CAPPED', newClose: isoAt(18, 12) });
    k.set(at(18, 10));
    const blk = k.svc.placeBid('RFQ-T-1', bidBody('A', 970));
    expect(blk.extension).toMatchObject({ outcome: 'BLOCKED', extended: false, newClose: isoAt(18, 12) });
    const kinds = blk.auction.activity.map((a) => a.kind);
    expect(kinds).toContain('EXTENSION_CAPPED');
    expect(kinds).toContain('EXTENSION_BLOCKED');
    expect(blk.auction.auction.extensionCount).toBe(3);
    expect(blk.auction.auction.totalExtendedMin).toBe(12);

    k.set(at(18, 12)); // forced close reached
    expect(code(() => k.svc.placeBid('RFQ-T-1', bidBody('D', 1)))).toBe('AUCTION_CLOSED');
    const fin = k.svc.details('RFQ-T-1');
    expect(fin.auction.status).toBe('FORCE_CLOSED');
    expect(fin.auction.bidClose <= fin.auction.forcedBidClose).toBe(true);
    expect(fin.activity.at(-1)?.kind).toBe('AUCTION_FORCE_CLOSED');
    expect(fin.activity.at(-1)?.message).toMatch(/Winning bid: A at \$970\.00/);
  });

  it('ends as CLOSED (not force-closed) when it simply runs out of time', () => {
    const k = setup();
    k.set(at(12));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    k.set(at(18, 1));
    const d = k.svc.details('RFQ-T-1');
    expect(d.auction.status).toBe('CLOSED');
    expect(d.activity.at(-1)).toMatchObject({ kind: 'AUCTION_CLOSED', at: isoAt(18) });
  });

  it('an auction with no bids still closes cleanly', () => {
    const k = setup();
    k.set(at(18, 30));
    k.svc.settleAll();
    const d = k.svc.details('RFQ-T-1');
    expect(d.auction.status).toBe('CLOSED');
    expect(d.activity.at(-1)?.message).toMatch(/No bids were received/);
  });
});

describe('list & metrics', () => {
  it('lists active first, filters by status/search, shows lowest bid', () => {
    const k = setup();
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000));
    k.svc.createRfq(rfqBody({ refId: 'RFQ-T-2', name: 'Other lane', bidStart: isoAt(11) }));
    const all = k.svc.list();
    expect(all.map((x) => x.refId)).toEqual(['RFQ-T-1', 'RFQ-T-2']);
    expect(all[0]?.lowestBid).toEqual({ total: 1000, carrierName: 'A' });
    expect(all[0]).toMatchObject({ status: 'ACTIVE', forcedBidClose: isoAt(19), bidClose: isoAt(18) });
    expect(k.svc.list({ status: 'SCHEDULED' }).map((x) => x.refId)).toEqual(['RFQ-T-2']);
    expect(k.svc.list({ q: 'other' }).map((x) => x.refId)).toEqual(['RFQ-T-2']);
  });

  it('compares extended vs non-extended auctions (success metrics)', () => {
    const k = setup();
    k.set(at(17, 55));
    k.svc.placeBid('RFQ-T-1', bidBody('A', 1000)); // inside window -> extended to 18:05
    k.set(at(18, 2));
    k.svc.placeBid('RFQ-T-1', bidBody('B', 900)); // lands in the extension -> 10 % cheaper than at original close
    k.set(at(19, 30));
    const m = k.svc.metrics();
    expect(m.auctions).toMatchObject({ total: 1, closed: 1 });
    expect(m.comparison.extended).toMatchObject({ auctions: 1, avgBidsPerRfq: 2, avgPriceImprovementPct: 10 });
    expect(m.comparison.nonExtended.auctions).toBe(0);
    expect(m.extensions).toMatchObject({ total: 2, extraMinutesGranted: 10 });
  });
});

describe('demo seed', () => {
  it('builds history through the real code paths and respects every invariant', () => {
    const k = mkSvc();
    const base = Date.now();
    seedDemo(k.db, base);
    k.set(base);
    const l = k.svc.list();
    expect(l.length).toBe(7);
    const by = (s: string) => l.filter((x) => x.status === s).map((x) => x.refId);
    expect(by('ACTIVE')).toHaveLength(3);
    expect(by('SCHEDULED')).toHaveLength(1);
    expect(by('CLOSED')).toHaveLength(2);
    expect(by('FORCE_CLOSED')).toEqual(['RFQ-2026-NSA-FXT-0066']);
    for (const a of l) expect(Date.parse(a.bidClose)).toBeLessThanOrEqual(Date.parse(a.forcedBidClose));
    const live = l.find((x) => x.refId === 'RFQ-2026-MUM-RTM-0147')!;
    expect(live.extensionCount).toBe(2); // the non-L1 move at -2 min must NOT have extended it
    expect(Date.parse(live.bidClose) - base).toBe(17 * 60_000);
  });
});
