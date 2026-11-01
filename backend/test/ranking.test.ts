import { describe, expect, it } from 'vitest';
import { l1Changed, rankBids, rankChanged, rankLabel, type BidLite } from '../src/domain/ranking.js';

const b = (id: number, supId: number, total: number, atMs = id): BidLite => ({ id, supId, total, atMs });

describe('ranking', () => {
  it('returns an empty ranking for no bids', () => {
    expect(rankBids([])).toEqual([]);
  });
});
