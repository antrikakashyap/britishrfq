import { describe, expect, it } from 'vitest';
import { dateOnly, fromLocalInput, money, span, STATUS_TEXT, toLocalInput, TRIG_TEXT } from './format';

describe('formatting', () => {
  it('formats money in the auction currency', () => {
    expect(money(1234.5, 'USD')).toBe('$1,234.50');
    expect(money(900, 'EUR')).toBe('€900.00');
    expect(money(0)).toBe('$0.00');
  });

  it('writes durations in days, hours, minutes and seconds', () => {
    expect(span(90_061_000)).toBe('1d 1h 01m');
    expect(span(307_000)).toBe('5m 07s');
    expect(span(307_000, false)).toBe('5m');
    expect(span(3_600_000, false)).toBe('1h 00m');
  });

  it('round-trips a time through the datetime-local input format', () => {
    const ms = Date.UTC(2026, 10, 5, 12, 34, 56);
    const v = toLocalInput(ms);
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalInput(v)).toBe(Date.UTC(2026, 10, 5, 12, 34, 0));
  });

  it('has a label for every status and a sentence for every trigger', () => {
    expect(STATUS_TEXT).toEqual({ SCHEDULED: 'Scheduled', ACTIVE: 'Active', CLOSED: 'Closed', FORCE_CLOSED: 'Force closed' });
    for (const t of Object.values(TRIG_TEXT)) expect(t).toContain('X');
    expect(dateOnly(Date.UTC(2026, 10, 5, 12))).toMatch(/2026/);
  });
});
