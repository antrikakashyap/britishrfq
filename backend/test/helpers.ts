import { openDb } from '../src/db.js';
import { AuctionService } from '../src/service.js';

export const day = Date.UTC(2026, 10, 5); // 5 Nov 2026 00:00Z
/** hh:mm(:ss) on the test day -> epoch ms */
export const at = (h: number, m = 0, s = 0): number => day + ((h * 60 + m) * 60 + s) * 1000;
export const isoAt = (h: number, m = 0, s = 0): string => new Date(at(h, m, s)).toISOString();

export function mkSvc(start = at(9)) {
  let t = start;
  const db = openDb(':memory:');
  const svc = new AuctionService(db, () => t);
  return { db, svc, set: (ms: number) => (t = ms), get: () => t };
}

export const rfqBody = (o: Record<string, unknown> = {}) => ({
  refId: 'RFQ-T-1',
  name: 'Test lane',
  currency: 'USD',
  pickupDate: '2026-11-20',
  bidStart: isoAt(10),
  bidClose: isoAt(18),
  forcedBidClose: isoAt(19),
  triggerWindowMin: 10,
  extensionMin: 5,
  triggerType: 'BID_RECEIVED',
  ...o,
});

export const bidBody = (carrierName: string, total: number, o: Record<string, unknown> = {}) => ({
  carrierName,
  freightCharges: Math.round(total * 0.8 * 100) / 100,
  originCharges: Math.round(total * 0.1 * 100) / 100,
  destinationCharges: Math.round((total - Math.round(total * 0.8 * 100) / 100 - Math.round(total * 0.1 * 100) / 100) * 100) / 100,
  transitTimeDays: 20,
  quoteValidityDays: 14,
  ...o,
});
