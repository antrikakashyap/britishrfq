import { AppError } from './errors.js';
import type { AuctionService } from './service.js';

const POOL = ['Maersk Line', 'MSC Cargo', 'CMA CGM', 'Hapag-Lloyd', 'Evergreen Marine', 'ONE Express', 'DHL Global Forwarding', 'Kuehne+Nagel', 'DB Schenker', 'Blue Dart Freight'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;
const c2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Demo helper: a "rival carrier" places a realistic bid so the extension logic can be
 * watched live without opening several browser tabs. Goes through the exact same
 * placeBid() path (all rules apply) - it is NOT a back door.
 */
export function rivalBid(svc: AuctionService, key: string) {
  const d = svc.details(key);
  const top = d.ranking[0];
  const rows = d.ranking;
  let nm: string;
  let total: number;
  if (!rows.length) {
    nm = pick(POOL);
    total = rnd(2400, 5200);
  } else {
    const lows = rows.filter((x) => !x.isLowest);
    const mine = lows.length && Math.random() < 0.75 ? pick(lows) : null;
    if (mine) {
      nm = mine.carrierName;
      const base = Math.min(mine.total, top!.total * 1.04);
      total = Math.min(mine.total * (1 - rnd(0.004, 0.02)), Math.max(base * rnd(0.97, 0.999), 1));
      if (total >= mine.total) total = mine.total * 0.99;
    } else {
      const fresh = POOL.filter((n) => !rows.some((x) => x.carrierName.toLowerCase() === n.toLowerCase()));
      if (!fresh.length) {
        const t = pick(rows);
        nm = t.carrierName;
        total = t.total * (1 - rnd(0.003, 0.012));
      } else {
        nm = pick(fresh);
        total = top!.total * rnd(0.94, 1.06);
      }
    }
  }
  total = c2(total);
  const fr = c2(total * 0.82);
  const og = c2(total * 0.09);
  const ds = c2(total - fr - og);
  try {
    return svc.placeBid(key, {
      carrierName: nm,
      freightCharges: fr,
      originCharges: og,
      destinationCharges: ds,
      transitTimeDays: Math.round(rnd(12, 34)),
      quoteValidityDays: pick([7, 14, 21, 30]),
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'BID_NOT_LOWER') return rivalBid(svc, key);
    throw e;
  }
}
