import type { Details, ListItem } from '../api';

const T = (m: number) => new Date(Date.UTC(2026, 10, 5, 12, m)).toISOString();
const q = (name: string, total: number, rank: number, extra = {}) => ({
  bidId: rank, carrierName: name, total, freightCharges: total - 100, originCharges: 60, destinationCharges: 40,
  transitTimeDays: 20, quoteValidityDays: 14, validUntil: T(60 * 24 * 14), submittedAt: T(rank), ...extra,
});

export const details = (status: Details['auction']['status'] = 'ACTIVE'): Details => ({
  serverTime: T(0),
  auction: {
    id: 1, refId: 'RFQ-T-1', name: 'Mumbai → Rotterdam', description: 'Test lane', currency: 'USD', status,
    pickupDate: T(0), bidStart: T(-120), bidClose: T(65), originalBidClose: T(60), forcedBidClose: T(120),
    extensionCount: 1, totalExtendedMin: 5, bidCount: 3, supplierCount: 2,
    lowestBid: { total: 900, carrierName: 'Bravo Cargo' }, config: { triggerWindowMin: 10, extensionMin: 5, triggerType: 'BID_RECEIVED', triggerLabel: 'Bid received in last 10 minutes' },
  },
  ranking: [
    { ...q('Bravo Cargo', 900, 1), rank: 1, label: 'L1', bidsPlaced: 2, isLowest: true },
    { ...q('Alpha Freight', 950, 2), rank: 2, label: 'L2', bidsPlaced: 1, isLowest: false },
  ],
  bids: [
    { ...q('Bravo Cargo', 900, 1), supplierRank: 1, isCurrent: true },
    { ...q('Alpha Freight', 950, 2), supplierRank: 2, isCurrent: true },
    { ...q('Bravo Cargo', 1000, 3), supplierRank: 1, isCurrent: false },
  ],
  bidsTotal: 3,
  history: [
    { carrierName: 'Bravo Cargo', total: 1000, submittedAt: T(-30) },
    { carrierName: 'Alpha Freight', total: 950, submittedAt: T(-20) },
    { carrierName: 'Bravo Cargo', total: 900, submittedAt: T(-10) },
  ],
  activity: [
    { id: 1, kind: 'RFQ_CREATED', message: 'RFQ created', reason: null, carrierName: null, previousClose: null, newClose: null, at: T(-120) },
    { id: 2, kind: 'BID_SUBMITTED', message: 'Bravo Cargo submitted a bid of $900.00 - now L1', reason: null, carrierName: 'Bravo Cargo', previousClose: null, newClose: null, at: T(-10) },
    { id: 3, kind: 'TIME_EXTENDED', message: 'Auction extended by 5 min', reason: 'Trigger "Bid received in last X minutes": a bid from Bravo Cargo arrived', carrierName: 'Bravo Cargo', previousClose: T(60), newClose: T(65), at: T(-9) },
  ],
  activityTotal: 3,
});

export const listItem = (o: Partial<ListItem> = {}): ListItem => ({
  id: 1, refId: 'RFQ-T-1', name: 'Mumbai → Rotterdam', currency: 'USD', status: 'ACTIVE',
  lowestBid: { total: 900, carrierName: 'Bravo Cargo' }, bidCount: 3, supplierCount: 2,
  bidStart: T(-120), bidClose: T(65), originalBidClose: T(60), forcedBidClose: T(120), extensionCount: 1,
  config: { triggerWindowMin: 10, extensionMin: 5, triggerType: 'BID_RECEIVED', triggerLabel: 'x' }, ...o,
});
