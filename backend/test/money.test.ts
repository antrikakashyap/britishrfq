import { describe, expect, it } from 'vitest';
import { fromCents, isMoney, toCents } from '../src/domain/money.js';

describe('money', () => {
  it('turns decimals into whole cents', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
    expect(toCents(1000)).toBe(100000);
  });

  it('turns whole cents back into decimals', () => {
    expect(fromCents(1999)).toBe(19.99);
    expect(fromCents(5)).toBe(0.05);
  });

  it('accepts amounts with at most two decimals', () => {
    for (const n of [0, 10, 10.5, 10.55, 123456.78]) expect(isMoney(n)).toBe(true);
  });

  it('rejects three decimals and non-finite numbers', () => {
    for (const n of [10.555, Number.NaN, Number.POSITIVE_INFINITY, 0.001]) expect(isMoney(n)).toBe(false);
  });

  it('round-trips every cent value from 0 to 10,000', () => {
    for (let c = 0; c <= 10_000; c++) expect(toCents(fromCents(c))).toBe(c);
  });
});
