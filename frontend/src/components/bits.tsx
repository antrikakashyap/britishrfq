import { STATUS_TEXT } from '../lib/format';
import type { Status } from '../api';

export function StatusBadge({ s }: { s: Status }) {
  return (
    <span className={`badge ${s}`}>
      <i aria-hidden /> {STATUS_TEXT[s]}
    </span>
  );
}

/** Colour follows the supplier (order of first bid), never its current rank. 9th+ fold into neutral grey. */
export function supplierColors(bids: { carrierName: string; submittedAt: string }[]): Map<string, string> {
  const first = new Map<string, number>();
  for (const b of bids) {
    const t = Date.parse(b.submittedAt);
    first.set(b.carrierName, Math.min(first.get(b.carrierName) ?? Infinity, t));
  }
  const order = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  return new Map(order.map((n, i) => [n, `var(--s${i < 8 ? i + 1 : 9})`]));
}

/** Second, non-colour identity for a series: solid for the first four, dashed variants after. */
export const DASHES = ['', '', '', '', '7 4', '7 4', '2 4', '2 4', '10 3 2 3'];
export const seriesIndex = (c: string): number => (c.startsWith('var(--s') ? Number(c.slice(7, -1)) - 1 : 8);
