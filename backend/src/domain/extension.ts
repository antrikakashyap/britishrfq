import { MIN_MS, type TrigType } from './types.js';
import { l1Changed, rankChanged, type RankRow } from './ranking.js';

export type ExtOutcome =
  | 'NONE' // nothing to do (outside the window, or trigger condition not met)
  | 'EXTENDED' // close moved by the full Y minutes
  | 'CAPPED' // close moved, but clipped to the forced close
  | 'BLOCKED'; // trigger fired but the auction is already at the forced close

export interface ExtInput {
  trig: TrigType;
  winMin: number; // X
  extMin: number; // Y
  closeMs: number; // current bid close
  forcedMs: number;
  nowMs: number; // time the bid was received (server clock)
  before: readonly RankRow[]; // ranking before the bid
  after: readonly RankRow[]; // ranking after the bid
}

export interface ExtResult {
  inWindow: boolean;
  fired: boolean;
  outcome: ExtOutcome;
  newCloseMs: number;
  windowStartMs: number;
}

/**
 * Decides whether a just-accepted bid extends the auction.
 *
 *  - The trigger window is [close - X, close): inclusive at the start, exclusive at the end
 *    (a bid at exactly `close` is rejected before it ever gets here).
 *  - An extension adds Y minutes to the CURRENT close (6:00 -> 6:05), not to "now".
 *  - The new close is clamped to the forced close, always.
 */
export function evalExtension(i: ExtInput): ExtResult {
  const windowStartMs = i.closeMs - i.winMin * MIN_MS;
  const inWindow = i.nowMs >= windowStartMs && i.nowMs < i.closeMs;
  const none: ExtResult = { inWindow, fired: false, outcome: 'NONE', newCloseMs: i.closeMs, windowStartMs };
  if (!inWindow) return none;

  const fired =
    i.trig === 'BID_RECEIVED' ||
    (i.trig === 'ANY_RANK_CHANGE' && rankChanged(i.before, i.after)) ||
    (i.trig === 'L1_CHANGE' && l1Changed(i.before, i.after));
  if (!fired) return none;

  if (i.closeMs >= i.forcedMs) return { ...none, fired, outcome: 'BLOCKED' };
  const target = i.closeMs + i.extMin * MIN_MS;
  const newCloseMs = Math.min(target, i.forcedMs);
  return { inWindow, fired, outcome: target > i.forcedMs ? 'CAPPED' : 'EXTENDED', newCloseMs, windowStartMs };
}
