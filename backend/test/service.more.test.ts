import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import { at, bidBody, isoAt, mkSvc, rfqBody } from './helpers.js';

const open = (o: Record<string, unknown> = {}) => {
  const k = mkSvc(at(9));
  k.svc.createRfq(rfqBody(o));
  k.set(at(12));
  return k;
};

describe('service details', () => {
  it('finds an RFQ by reference regardless of letter case', () => {
    const k = open();
    expect(k.svc.details('rfq-t-1').auction.refId).toBe('RFQ-T-1');
  });

  it('answers 404 for an unknown reference', () => {
    const k = open();
    try {
      k.svc.details('NOPE');
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('NOT_FOUND');
    }
  });
});
