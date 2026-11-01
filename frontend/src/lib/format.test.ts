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
});
