import type { Status, Timing } from './types.js';

/**
 * Lifecycle is a pure function of (timing, now):
 *   now <  start                      -> SCHEDULED
 *   start <= now < current close      -> ACTIVE
 *   now >= close, close <  forced     -> CLOSED        (ended on a normal close)
 *   now >= close, close == forced     -> FORCE_CLOSED  (extensions ran into the ceiling)
 */
export function statusAt(t: Timing, now: number): Status {
  if (now < t.startMs) return 'SCHEDULED';
  if (now < t.closeMs) return 'ACTIVE';
  return t.closeMs >= t.forcedMs ? 'FORCE_CLOSED' : 'CLOSED';
}
