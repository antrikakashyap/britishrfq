import { describe, expect, it } from 'vitest';
import { statusAt } from '../src/domain/status.js';
import { at } from './helpers.js';

const t = { startMs: at(10), closeMs: at(18), forcedMs: at(19) };

describe('status boundaries', () => {
  it('is SCHEDULED one millisecond before the start and ACTIVE at the start', () => {
    expect(statusAt(t, at(10) - 1)).toBe('SCHEDULED');
    expect(statusAt(t, at(10))).toBe('ACTIVE');
  });
});
