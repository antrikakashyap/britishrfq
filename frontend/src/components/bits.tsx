import { STATUS_TEXT } from '../lib/format';
import type { BidRow, Status } from '../api';

export function StatusBadge({ s }: { s: Status }) {
  return (
    <span className={`badge ${s}`}>
      <i aria-hidden /> {STATUS_TEXT[s]}
    </span>
  );
}

/** Colour follows the supplier (order of first bid), never its current rank. 9th+ fold into neutral grey. */
export function supplierColors(bids: BidRow[]): Map<string, string> {
  const first = new Map<string, number>();
  for (const b of bids) {
    const t = Date.parse(b.submittedAt);
    first.set(b.carrierName, Math.min(first.get(b.carrierName) ?? Infinity, t));
  }
  const order = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  return new Map(order.map((n, i) => [n, `var(--s${i < 8 ? i + 1 : 9})`]));
}
