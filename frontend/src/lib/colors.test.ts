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
});
