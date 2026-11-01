import { describe, expect, it } from 'vitest';
import { DASHES, seriesIndex, supplierColors } from '../components/bits';

const at = (m: number) => new Date(Date.UTC(2026, 10, 5, 12, m)).toISOString();

describe('supplier colours', () => {
  it('gives each supplier a colour in the order of its first bid, not its rank', () => {
    const c = supplierColors([
      { carrierName: 'Late', submittedAt: at(30) },
      { carrierName: 'First', submittedAt: at(1) },
      { carrierName: 'Second', submittedAt: at(5) },
    ]);
    expect([c.get('First'), c.get('Second'), c.get('Late')]).toEqual(['var(--s1)', 'var(--s2)', 'var(--s3)']);
  });

  it('folds the ninth supplier and beyond into the neutral grey', () => {
    const bids = Array.from({ length: 10 }, (_, i) => ({ carrierName: `S${i}`, submittedAt: at(i) }));
    const c = supplierColors(bids);
    expect(c.get('S7')).toBe('var(--s8)');
    expect(c.get('S8')).toBe('var(--s9)');
    expect(c.get('S9')).toBe('var(--s9)');
  });

  it('adds a dash pattern to later series so colour is not the only clue', () => {
    expect(seriesIndex('var(--s3)')).toBe(2);
    expect(seriesIndex('var(--s9)')).toBe(8);
    expect(DASHES).toHaveLength(9);
    expect(DASHES.slice(0, 4).every((d) => d === '')).toBe(true);
    expect(DASHES[4]).not.toBe('');
  });
});
