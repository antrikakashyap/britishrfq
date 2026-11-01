import { describe, expect, it } from 'vitest';
import { l1Changed, rankBids, rankChanged, rankLabel, type BidLite } from '../src/domain/ranking.js';

const b = (id: number, supId: number, total: number, atMs = id): BidLite => ({ id, supId, total, atMs });

describe('ranking', () => {
  it('returns an empty ranking for no bids', () => {
    expect(rankBids([])).toEqual([]);
  });

  it('ranks a single supplier as L1', () => {
    const r = rankBids([b(1, 7, 500)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ supId: 7, rank: 1 });
    expect(rankLabel(r[0]!.rank)).toBe('L1');
  });

  it('breaks a full tie (same price, same time) by the lower bid id', () => {
    const r = rankBids([b(2, 1, 400, 10), b(1, 2, 400, 10)]);
    expect(r.map((x) => x.supId)).toEqual([2, 1]);
  });

  it('uses only a supplier’s best bid, not its older higher ones', () => {
    const r = rankBids([b(1, 1, 900), b(2, 2, 800), b(3, 1, 700)]);
    expect(r.map((x) => [x.supId, x.total])).toEqual([[1, 700], [2, 800]]);
  });

  it('numbers five suppliers L1 to L5 in price order', () => {
    const r = rankBids([b(1, 1, 50), b(2, 2, 10), b(3, 3, 40), b(4, 4, 20), b(5, 5, 30)]);
    expect(r.map((x) => rankLabel(x.rank))).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    expect(r.map((x) => x.supId)).toEqual([2, 4, 5, 3, 1]);
  });

  it('reports no rank change for identical rankings and a change when a supplier joins', () => {
    const a = rankBids([b(1, 1, 100), b(2, 2, 200)]);
    expect(rankChanged(a, a)).toBe(false);
    expect(rankChanged(a, rankBids([b(1, 1, 100), b(2, 2, 200), b(3, 3, 300)]))).toBe(true);
  });
});
