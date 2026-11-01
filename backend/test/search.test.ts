import { describe, expect, it } from 'vitest';
import { at, mkSvc, rfqBody } from './helpers.js';

describe('list search', () => {
  it('copes with a very long search text without error', () => {
    const k = mkSvc(at(9));
    k.svc.createRfq(rfqBody());
    expect(k.svc.list({ q: 'x'.repeat(5000) })).toEqual([]);
    expect(k.svc.list({ q: 'rfq-t-1' + ' '.repeat(10) })).toHaveLength(1);
  });
});
