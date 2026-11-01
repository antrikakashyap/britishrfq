import { describe, expect, it } from 'vitest';
import { span } from './format';
import { timelineIssues } from './validate';

const H = 3600_000;
const ok = { start: 1 * H, close: 5 * H, forced: 6 * H, x: 10, y: 5, now: 0 };

describe('timelineIssues', () => {
  it('accepts a valid timeline', () => expect(timelineIssues(ok)).toEqual({}));
  it('forced close must be later than bid close', () => {
    expect(timelineIssues({ ...ok, forced: ok.close }).forcedBidClose).toMatch(/later than bid close/);
    expect(timelineIssues({ ...ok, forced: ok.close - 1 }).forcedBidClose).toBeTruthy();
  });
  it('catches close before start, past close, oversized window, bad Y', () => {
    expect(timelineIssues({ ...ok, close: 0.5 * H }).bidClose).toBeTruthy();
    expect(timelineIssues({ ...ok, now: 9 * H }).bidClose).toMatch(/future/);
    expect(timelineIssues({ ...ok, x: 500 }).triggerWindowMin).toBeTruthy();
    expect(timelineIssues({ ...ok, y: 0 }).extensionMin).toBeTruthy();
  });
});

describe('span', () => {
  it('formats durations', () => {
    expect(span(65_000)).toBe('1m 05s');
    expect(span(3_725_000)).toBe('1h 02m 05s');
    expect(span(-5)).toBe('0m 00s');
  });
});
