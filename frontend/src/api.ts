export type Status = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'FORCE_CLOSED';
export type TrigType = 'BID_RECEIVED' | 'ANY_RANK_CHANGE' | 'L1_CHANGE';

export interface Config {
  triggerWindowMin: number;
  extensionMin: number;
  triggerType: TrigType;
  triggerLabel: string;
}
export interface ListItem {
  id: number;
  refId: string;
  name: string;
  currency: string;
  status: Status;
  lowestBid: { total: number; carrierName: string } | null;
  bidCount: number;
  supplierCount: number;
  bidStart: string;
  bidClose: string;
  originalBidClose: string;
  forcedBidClose: string;
  extensionCount: number;
  config: Config;
}
export interface Quote {
  bidId: number;
  carrierName: string;
  total: number;
  freightCharges: number;
  originCharges: number;
  destinationCharges: number;
  transitTimeDays: number;
  quoteValidityDays: number;
  validUntil: string;
  submittedAt: string;
}
export interface RankRow extends Quote {
  rank: number;
  label: string;
  bidsPlaced: number;
  isLowest: boolean;
}
export interface BidRow extends Quote {
  supplierRank: number;
  isCurrent: boolean;
}
export type LogKind =
  | 'RFQ_CREATED' | 'AUCTION_STARTED' | 'BID_SUBMITTED' | 'TIME_EXTENDED'
  | 'EXTENSION_CAPPED' | 'EXTENSION_BLOCKED' | 'AUCTION_CLOSED' | 'AUCTION_FORCE_CLOSED';
export interface LogRow {
  id: number;
  kind: LogKind;
  message: string;
  reason: string | null;
  carrierName: string | null;
  previousClose: string | null;
  newClose: string | null;
  at: string;
}
export interface Details {
  serverTime: string;
  auction: Omit<ListItem, 'lowestBid'> & {
    description: string | null;
    pickupDate: string;
    totalExtendedMin: number;
    lowestBid: { total: number; carrierName: string } | null;
  };
  ranking: RankRow[];
  bids: BidRow[];
  /** total bids in the auction (the table may show fewer) */
  bidsTotal: number;
  /** every bid as (carrier, price, time) - drives the chart and supplier colours */
  history: { carrierName: string; total: number; submittedAt: string }[];
  activity: LogRow[];
  activityTotal: number;
}
export interface BidResult {
  bidId: number;
  rank: number;
  rankLabel: string;
  suppliers: number;
  extension: { outcome: 'NONE' | 'EXTENDED' | 'CAPPED' | 'BLOCKED'; extended: boolean; previousClose: string; newClose: string };
  auction: Details;
}
export interface Metrics {
  auctions: { total: number; scheduled: number; active: number; closed: number; forceClosed: number };
  bids: { total: number; avgPerRfq: number };
  extensions: { total: number; auctionsExtended: number; extraMinutesGranted: number };
  comparison: {
    extended: { auctions: number; avgBidsPerRfq: number | null; avgPriceImprovementPct: number | null };
    nonExtended: { auctions: number; avgBidsPerRfq: number | null };
  };
}

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly fields: Record<string, string[]> = {}) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Check that the API is running.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(e.code ?? 'ERROR', e.message ?? `Request failed (${res.status})`, res.status, e.fields ?? {});
  }
  syncClock(body?.serverTime);
  return body as T;
}
const post = <T,>(p: string, data?: unknown) => call<T>(p, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  list: (q = '', status = 'ALL') => call<ListItem[]>(`/auctions?status=${status}&q=${encodeURIComponent(q)}`),
  get: (key: string, bids?: 'all') => call<Details>(`/auctions/${encodeURIComponent(key)}${bids ? `?bids=${bids}` : ''}`),
  create: (data: unknown) => post<Details>('/auctions', data),
  bid: (key: string, data: unknown) => post<BidResult>(`/auctions/${encodeURIComponent(key)}/bids`, data),
  simulate: (key: string) => post<BidResult>(`/auctions/${encodeURIComponent(key)}/simulate`),
  metrics: () => call<Metrics>('/metrics'),
  meta: () => call<{ demo: boolean; serverTime: string }>('/meta'),
};

/* ---- server-synchronised clock: countdowns must follow the SERVER, not a skewed laptop ---- */
let skew = 0;
export function syncClock(serverIso?: string): void {
  if (serverIso) skew = Date.parse(serverIso) - Date.now();
}
export const serverNow = (): number => Date.now() + skew;
