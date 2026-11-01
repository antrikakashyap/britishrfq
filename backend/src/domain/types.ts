export type Status = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'FORCE_CLOSED';
export type Clock = () => number;

export const TRIGGERS = ['BID_RECEIVED', 'ANY_RANK_CHANGE', 'L1_CHANGE'] as const;
export type TrigType = (typeof TRIGGERS)[number];
export const MIN_MS = 60_000;

export const TRIGGER_LABEL: Record<TrigType, string> = {
  BID_RECEIVED: 'Bid received in last X minutes',
  ANY_RANK_CHANGE: 'Any supplier rank change in last X minutes',
  L1_CHANGE: 'Lowest bidder (L1) rank change in last X minutes',
};

/** Timing facts of an auction - all the status maths needs. */
export interface Timing {
  startMs: number;
  closeMs: number;
  forcedMs: number;
}
