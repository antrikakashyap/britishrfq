export const money = (n: number, cur = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n);

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const tzShort = (): string =>
  new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? tz;

export const time = (iso: string | number, secs = false): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: secs ? '2-digit' : undefined });
export const dayTime = (iso: string | number): string => {
  const d = new Date(iso);
  const same = d.toDateString() === new Date().toDateString();
  return same ? time(iso) : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time(iso)}`;
};
export const fullDate = (iso: string | number): string =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const dateOnly = (iso: string | number): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** 3725000 -> "1h 02m 05s"; negative -> "0s" */
export function span(ms: number, secs = true): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m${secs ? ` ${String(s).padStart(2, '0')}s` : ''}`;
  return secs ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
}

/** value for <input type="datetime-local"> in the user's local zone */
export function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
/** <input type="datetime-local"> value -> epoch ms (interpreted in the user's zone) */
export const fromLocalInput = (v: string): number => new Date(v).getTime();

export const STATUS_TEXT = { SCHEDULED: 'Scheduled', ACTIVE: 'Active', CLOSED: 'Closed', FORCE_CLOSED: 'Force closed' } as const;
export const TRIG_TEXT = {
  BID_RECEIVED: 'Any bid in the last X minutes',
  ANY_RANK_CHANGE: 'Any supplier rank change in the last X minutes',
  L1_CHANGE: 'Lowest bidder (L1) change in the last X minutes',
} as const;
