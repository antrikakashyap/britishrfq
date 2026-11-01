import { describe, expect, it } from 'vitest';
import { evalExtension } from '../src/domain/extension.js';
import { l1Changed, rankBids, rankChanged, type RankRow } from '../src/domain/ranking.js';
import { statusAt } from '../src/domain/status.js';
import { timelineErrors } from '../src/domain/validation.js';
import { isMoney, toCents } from '../src/domain/money.js';
import { at } from './helpers.js';

const r = (...rows: [supId: number, total: number, atMs?: number][]): RankRow[] =>
  rankBids(rows.map(([supId, total, atMs], i) => ({ id: i + 1, supId, total, atMs: atMs ?? i })));

describe('ranking', () => {
  it('uses each supplier’s best bid and orders by price (L1 = lowest)', () => {
    const k = r([1, 500], [2, 400], [1, 300]);
    expect(k.map((x) => [x.supId, x.rank, x.total])).toEqual([[1, 1, 300], [2, 2, 400]]);
  });
  it('breaks equal prices in favour of the earlier bid', () => {
    const k = r([1, 400, 10], [2, 400, 5]);
    expect(k.map((x) => x.supId)).toEqual([2, 1]);
  });
  it('detects rank change vs L1 change separately', () => {
    const before = r([1, 100], [2, 200], [3, 300]);
    const swapLow = r([1, 100], [2, 200], [3, 150]); // 3 jumps over 2, L1 unchanged
    expect(rankChanged(before, swapLow)).toBe(true);
    expect(l1Changed(before, swapLow)).toBe(false);
    const newL1 = r([1, 100], [2, 90], [3, 300]);
    expect(l1Changed(before, newL1)).toBe(true);
    const same = r([1, 100], [2, 190], [3, 300]); // price drop, order unchanged
    expect(rankChanged(before, same)).toBe(false);
    expect(l1Changed([], r([1, 100]))).toBe(true); // first bid establishes L1
  });
});

const base = { winMin: 10, extMin: 5, closeMs: at(18), forcedMs: at(19), before: r([1, 200], [2, 300]), after: r([2, 150], [1, 200]) };

describe('evalExtension - spec examples (close 6:00 PM, X = 10, Y = 5)', () => {
  it('bid at 5:55 PM extends 6:00 -> 6:05 (BID_RECEIVED)', () => {
    const e = evalExtension({ ...base, trig: 'BID_RECEIVED', nowMs: at(17, 55) });
    expect(e).toMatchObject({ inWindow: true, fired: true, outcome: 'EXTENDED', newCloseMs: at(18, 5) });
  });
  it('window is [5:50, 6:00): start inclusive, 5:49:59.999 outside', () => {
    expect(evalExtension({ ...base, trig: 'BID_RECEIVED', nowMs: at(17, 50) }).outcome).toBe('EXTENDED');
    expect(evalExtension({ ...base, trig: 'BID_RECEIVED', nowMs: at(17, 50) - 1 }).outcome).toBe('NONE');
    expect(evalExtension({ ...base, trig: 'BID_RECEIVED', nowMs: at(18) }).inWindow).toBe(false);
  });
  it('rank change at 5:58 PM extends (ANY_RANK_CHANGE)', () => {
    expect(evalExtension({ ...base, trig: 'ANY_RANK_CHANGE', nowMs: at(17, 58) }).newCloseMs).toBe(at(18, 5));
  });
  it('ANY_RANK_CHANGE ignores a price drop that does not reorder anyone', () => {
    const e = evalExtension({ ...base, trig: 'ANY_RANK_CHANGE', nowMs: at(17, 58), before: r([1, 100], [2, 200]), after: r([1, 100], [2, 150]) });
    expect(e).toMatchObject({ inWindow: true, fired: false, outcome: 'NONE', newCloseMs: at(18) });
  });
  it('new L1 at 5:59 PM extends; a non-L1 rank change does not (L1_CHANGE)', () => {
    expect(evalExtension({ ...base, trig: 'L1_CHANGE', nowMs: at(17, 59) }).outcome).toBe('EXTENDED');
    const e = evalExtension({ ...base, trig: 'L1_CHANGE', nowMs: at(17, 59), before: r([1, 100], [2, 200], [3, 300]), after: r([1, 100], [3, 150], [2, 200]) });
    expect(e.outcome).toBe('NONE');
  });
  it('nothing happens outside the trigger window, whatever the trigger', () => {
    for (const trig of ['BID_RECEIVED', 'ANY_RANK_CHANGE', 'L1_CHANGE'] as const)
      expect(evalExtension({ ...base, trig, nowMs: at(17, 30) }).outcome).toBe('NONE');
  });
});

describe('evalExtension - forced close ceiling', () => {
  const near = { ...base, trig: 'BID_RECEIVED' as const, closeMs: at(18, 58), nowMs: at(18, 55) };
  it('clips the extension to the Forced Bid Close (CAPPED)', () => {
    expect(evalExtension(near)).toMatchObject({ outcome: 'CAPPED', newCloseMs: at(19) });
  });
  it('an extension that lands exactly on the forced close is a normal EXTENDED', () => {
    expect(evalExtension({ ...near, closeMs: at(18, 55), nowMs: at(18, 52) })).toMatchObject({ outcome: 'EXTENDED', newCloseMs: at(19) });
  });
  it('is BLOCKED once the close already equals the forced close', () => {
    expect(evalExtension({ ...near, closeMs: at(19), nowMs: at(18, 58) })).toMatchObject({ outcome: 'BLOCKED', newCloseMs: at(19) });
  });
  it('can never return a close beyond forced - property check over many inputs', () => {
    for (let c = 0; c < 200; c++) {
      const closeMs = at(18) + c * 18_000; // always <= forced (DB CHECK guarantees the invariant)
      const out = evalExtension({ ...base, trig: 'BID_RECEIVED', closeMs, nowMs: closeMs - 60_000, extMin: 1 + (c % 30) });
      expect(out.newCloseMs).toBeLessThanOrEqual(at(19));
      expect(out.newCloseMs).toBeGreaterThanOrEqual(closeMs);
    }
  });
});

describe('statusAt', () => {
  const t = { startMs: at(10), closeMs: at(18), forcedMs: at(19) };
  it('maps time to lifecycle', () => {
    expect(statusAt(t, at(9))).toBe('SCHEDULED');
    expect(statusAt(t, at(10))).toBe('ACTIVE');
    expect(statusAt(t, at(18) - 1)).toBe('ACTIVE');
    expect(statusAt(t, at(18))).toBe('CLOSED');
    expect(statusAt({ ...t, closeMs: at(19) }, at(19))).toBe('FORCE_CLOSED');
  });
});

describe('timelineErrors (spec section 7)', () => {
  const v = { bidStart: at(10), bidClose: at(18), forcedBidClose: at(19), triggerWindowMin: 10 };
  it('accepts a sane timeline', () => expect(timelineErrors(v, at(9))).toEqual({}));
  it('forced close must be strictly later than bid close', () => {
    expect(timelineErrors({ ...v, forcedBidClose: at(18) }, at(9))['forcedBidClose']).toBeTruthy();
    expect(timelineErrors({ ...v, forcedBidClose: at(17) }, at(9))['forcedBidClose']).toBeTruthy();
  });
  it('bid close after start, in the future, and X within the bidding period', () => {
    expect(timelineErrors({ ...v, bidClose: at(10) }, at(9))['bidClose']).toBeTruthy();
    expect(timelineErrors(v, at(18, 1))['bidClose']).toBeTruthy();
    expect(timelineErrors({ ...v, triggerWindowMin: 9 * 60 }, at(9))['triggerWindowMin']).toBeTruthy();
  });
});

describe('money', () => {
  it('uses exact integer cents', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(isMoney(10.55)).toBe(true);
    expect(isMoney(10.555)).toBe(false);
  });
});
