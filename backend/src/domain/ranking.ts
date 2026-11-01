export interface BidLite {
  id: number;
  supId: number;
  total: number; // cents
  atMs: number;
}

export interface RankRow extends BidLite {
  rank: number; // 1 = L1
}

/** lower price wins; on equal price the EARLIER bid wins; id is the final tiebreak. */
export const byPrice = (a: BidLite, b: BidLite): number =>
  a.total - b.total || a.atMs - b.atMs || a.id - b.id;

/**
 * Supplier ranking: each supplier is represented by its best (lowest) bid,
 * suppliers are ordered by price. rank 1 is "L1".
 */
export function rankBids(bids: readonly BidLite[]): RankRow[] {
  const best = new Map<number, BidLite>();
  for (const b of bids) {
    const cur = best.get(b.supId);
    if (!cur || byPrice(b, cur) < 0) best.set(b.supId, b);
  }
  return [...best.values()].sort(byPrice).map((b, i) => ({ ...b, rank: i + 1 }));
}

export const rankLabel = (rank: number): string => `L${rank}`;

/** Did the ordered list of suppliers change (a new entrant or any reorder)? */
export function rankChanged(before: readonly RankRow[], after: readonly RankRow[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((r, i) => r.supId !== after[i]?.supId);
}

/** Did the lowest bidder (L1) change? The very first bid counts: none -> someone. */
export function l1Changed(before: readonly RankRow[], after: readonly RankRow[]): boolean {
  return before[0]?.supId !== after[0]?.supId;
}
