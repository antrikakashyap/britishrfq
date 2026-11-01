import { describe, expect, it } from 'vitest';
import { fromCents, isMoney, toCents } from '../src/domain/money.js';

describe('money', () => {
  it('turns decimals into whole cents', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
    expect(toCents(1000)).toBe(100000);
  });
});
