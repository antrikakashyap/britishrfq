import { describe, expect, it } from 'vitest';
import { statusAt } from '../src/domain/status.js';
import { at } from './helpers.js';

const t = { startMs: at(10), closeMs: at(18), forcedMs: at(19) };

describe('status boundaries', () => {
  it('is SCHEDULED one millisecond before the start and ACTIVE at the start', () => {
    expect(statusAt(t, at(10) - 1)).toBe('SCHEDULED');
    expect(statusAt(t, at(10))).toBe('ACTIVE');
  });

  it('is still ACTIVE one millisecond before the close', () => {
    expect(statusAt(t, at(18) - 1)).toBe('ACTIVE');
  });

  it('is CLOSED at the close when the forced close is later', () => {
    expect(statusAt(t, at(18))).toBe('CLOSED');
  });

  it('is FORCE_CLOSED at the close when the close equals the forced close', () => {
    expect(statusAt({ ...t, closeMs: at(19) }, at(19))).toBe('FORCE_CLOSED');
  });

  it('never changes again long after the end', () => {
    const far = at(19) + 365 * 86_400_000;
    expect(statusAt(t, far)).toBe('CLOSED');
    expect(statusAt({ ...t, closeMs: at(19) }, far)).toBe('FORCE_CLOSED');
  });
});
