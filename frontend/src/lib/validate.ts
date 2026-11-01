/** Mirrors the server's timeline rules (spec section 7) so the form can warn before submit. */
export interface TlIn {
  start: number;
  close: number;
  forced: number;
  x: number;
  y: number;
  now: number;
}
export function timelineIssues(v: TlIn): Record<string, string> {
  const e: Record<string, string> = {};
  if (Number.isNaN(v.start)) e.bidStart = 'Choose when bidding opens';
  if (Number.isNaN(v.close)) e.bidClose = 'Choose when bidding closes';
  if (Number.isNaN(v.forced)) e.forcedBidClose = 'Choose the forced close time';
  if (Object.keys(e).length) return e;
  if (v.close <= v.start) e.bidClose = 'Bid close must be after bid start';
  else if (v.close <= v.now) e.bidClose = 'Bid close must be in the future';
  if (v.forced <= v.close) e.forcedBidClose = 'Forced bid close must be later than bid close';
  if (!Number.isInteger(v.x) || v.x < 1 || v.x > 1440) e.triggerWindowMin = 'Enter whole minutes between 1 and 1440';
  else if (v.x * 60000 > v.close - v.start) e.triggerWindowMin = 'Trigger window cannot be longer than the bidding period';
  if (!Number.isInteger(v.y) || v.y < 1 || v.y > 1440) e.extensionMin = 'Enter whole minutes between 1 and 1440';
  return e;
}
