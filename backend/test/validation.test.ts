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

  it('trims the reference ID and the name', () => {
    const r = createSchema.safeParse(rfqBody({ refId: '  RFQ-X1  ', name: '  Lane  ' }));
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.refId, r.data.name]).toEqual(['RFQ-X1', 'Lane']);
  });

  it('rejects a reference ID that contains spaces', () => {
    expect(createSchema.safeParse(rfqBody({ refId: 'RFQ X1' })).success).toBe(false);
  });

  it('uses USD when no currency is given', () => {
    const { currency: _c, ...rest } = rfqBody();
    const r = createSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe('USD');
  });

  it('collects every field error, grouped by field name', () => {
    const r = createSchema.safeParse(rfqBody({ triggerWindowMin: 0, extensionMin: 0 }));
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(['extensionMin', 'triggerWindowMin']);
  });

  it('allows a trigger window as long as the whole bidding period', () => {
    const v = { bidStart: at(10), bidClose: at(11), forcedBidClose: at(12), triggerWindowMin: 60 };
    expect(timelineErrors(v, at(9))).toEqual({});
  });

  it('trims the carrier name on a bid', () => {
    const r = bidSchema.safeParse(bidBody('  Maersk Line  ', 1000));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.carrierName).toBe('Maersk Line');
  });

  it('accepts transit and validity of 1 and 365 days but not 0 or 366', () => {
    for (const d of [1, 365]) expect(bidSchema.safeParse(bidBody('A1', 1000, { transitTimeDays: d, quoteValidityDays: d })).success).toBe(true);
    for (const d of [0, 366]) expect(bidSchema.safeParse(bidBody('A1', 1000, { transitTimeDays: d })).success).toBe(false);
  });

  it('rejects a charge with three decimals and a bid that totals zero', () => {
    expect(bidSchema.safeParse(bidBody('A1', 1000, { freightCharges: 100.123 })).success).toBe(false);
    expect(bidSchema.safeParse({ ...bidBody('A1', 1000), freightCharges: 0, originCharges: 0, destinationCharges: 0 }).success).toBe(false);
  });
});
