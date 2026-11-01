import { z } from 'zod';
import { isMoney } from './money.js';
import { MIN_MS, TRIGGERS } from './types.js';

/** zod 4: one message for a missing value, another for a wrong type */
const need = (label: string, kind = 'text') => ({
  error: (i: { input?: unknown }) => (i.input === undefined ? `${label} is required` : `${label} must be ${kind}`),
});

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD'] as const;

const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** date-time WITH timezone -> epoch ms. A zone-less string is ambiguous, so we refuse it. */
const instant = (label: string) =>
  z
    .string(need(label))
    .trim()
    .refine((s) => ISO_DT.test(s) && !Number.isNaN(Date.parse(s)), {
      message: `${label} must be an ISO-8601 date-time with timezone, e.g. 2026-11-05T18:00:00Z`,
    })
    .transform((s) => Date.parse(s));

const pickup = z
  .string(need('Pickup / service date'))
  .trim()
  .refine((s) => (ISO_DT.test(s) || ISO_DAY.test(s)) && !Number.isNaN(Date.parse(s)), {
    message: 'Pickup / service date must be an ISO date (YYYY-MM-DD) or date-time',
  })
  .transform((s) => Date.parse(s));

const whole = (label: string, min: number, max: number) =>
  z
    .number(need(label, 'a number'))
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const createSchema = z.object({
  refId: z
    .string(need('RFQ reference ID'))
    .trim()
    .min(3, 'RFQ reference ID must be at least 3 characters')
    .max(40, 'RFQ reference ID must be at most 40 characters')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Use letters, digits and . _ / - only'),
  name: z.string(need('RFQ name')).trim().min(3, 'RFQ name must be at least 3 characters').max(120),
  description: z.string().trim().max(1000).optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  pickupDate: pickup,
  bidStart: instant('Bid start'),
  bidClose: instant('Bid close'),
  forcedBidClose: instant('Forced bid close'),
  triggerWindowMin: whole('Trigger window (X)', 1, 1440),
  extensionMin: whole('Extension duration (Y)', 1, 1440),
  triggerType: z.enum(TRIGGERS, { error: 'Choose an extension trigger' }),
});
export type CreateInput = z.infer<typeof createSchema>;

const money = (label: string) =>
  z
    .number(need(label, 'a number'))
    .min(0, `${label} cannot be negative`)
    .max(1_000_000_000, `${label} is too large`)
    .refine(isMoney, `${label} can have at most 2 decimal places`);

export const bidSchema = z
  .object({
    carrierName: z.string(need('Carrier name')).trim().min(1, 'Carrier name is required').max(80),
    freightCharges: money('Freight charges'),
    originCharges: money('Origin charges'),
    destinationCharges: money('Destination charges'),
    transitTimeDays: whole('Transit time', 1, 365),
    quoteValidityDays: whole('Quote validity', 1, 365),
  })
  .refine((v) => v.freightCharges + v.originCharges + v.destinationCharges > 0, {
    message: 'Total quote must be greater than zero',
    path: ['freightCharges'],
  });
export type BidInput = z.infer<typeof bidSchema>;

/** zod issues -> { "field": ["msg", ...] } */
export function fieldErrors(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const is of err.issues) (out[is.path.join('.') || '_'] ??= []).push(is.message);
  return out;
}

type Tl = Pick<CreateInput, 'bidStart' | 'bidClose' | 'forcedBidClose' | 'triggerWindowMin'>;

/**
 * Cross-field rules of the spec (section 7) + sanity checks.
 * Pure: `now` is a parameter, so it is deterministic and unit-testable.
 */
export function timelineErrors(v: Tl, now: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (k: string, m: string) => (out[k] ??= []).push(m);
  if (v.bidClose <= v.bidStart) add('bidClose', 'Bid close must be after bid start');
  // SPEC RULE: Forced Bid Close Time must always be greater than Bid Close Time
  if (v.forcedBidClose <= v.bidClose) add('forcedBidClose', 'Forced bid close must be later than bid close');
  if (v.bidClose <= now) add('bidClose', 'Bid close must be in the future');
  if (v.triggerWindowMin * MIN_MS > v.bidClose - v.bidStart)
    add('triggerWindowMin', 'Trigger window (X) cannot be longer than the bidding period (bid start to bid close)');
  return out;
}
