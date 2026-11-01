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
});
