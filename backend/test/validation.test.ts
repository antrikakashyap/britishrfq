import { describe, expect, it } from 'vitest';
import { bidSchema, createSchema, fieldErrors, timelineErrors } from '../src/domain/validation.js';
import { at, bidBody, rfqBody } from './helpers.js';

describe('input validation', () => {
  it('rejects a currency that is not supported', () => {
    expect(createSchema.safeParse(rfqBody({ currency: 'XYZ' })).success).toBe(false);
  });

  it('accepts a date-only pickup date and turns it into a timestamp', () => {
    const r = createSchema.safeParse(rfqBody({ pickupDate: '2026-11-20' }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.pickupDate).toBe(Date.parse('2026-11-20'));
  });
});
