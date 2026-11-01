import { describe, expect, it } from 'vitest';
import { dateOnly, fromLocalInput, money, span, STATUS_TEXT, toLocalInput, TRIG_TEXT } from './format';

describe('formatting', () => {
  it('formats money in the auction currency', () => {
    expect(money(1234.5, 'USD')).toBe('$1,234.50');
    expect(money(900, 'EUR')).toBe('€900.00');
    expect(money(0)).toBe('$0.00');
  });
});
