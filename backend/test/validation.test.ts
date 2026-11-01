import { describe, expect, it } from 'vitest';
import { bidSchema, createSchema, fieldErrors, timelineErrors } from '../src/domain/validation.js';
import { at, bidBody, rfqBody } from './helpers.js';

describe('input validation', () => {
  it('rejects a currency that is not supported', () => {
    expect(createSchema.safeParse(rfqBody({ currency: 'XYZ' })).success).toBe(false);
  });
});
