import { describe, expect, it } from 'vitest';
import { evalExtension } from '../src/domain/extension.js';
import { rankBids } from '../src/domain/ranking.js';
import { at } from './helpers.js';

const rk = (...rows: [supId: number, total: number][]) => rankBids(rows.map(([supId, total], i) => ({ id: i + 1, supId, total, atMs: i })));
const base = { winMin: 10, extMin: 5, closeMs: at(18), forcedMs: at(19), nowMs: at(17, 55), before: rk([1, 200], [2, 300]), after: rk([2, 150], [1, 200]) };

describe('extension edge cases', () => {
  it('works with a one-minute window', () => {
    const t = { ...base, trig: 'BID_RECEIVED' as const, winMin: 1 };
    expect(evalExtension({ ...t, nowMs: at(17, 59) }).outcome).toBe('EXTENDED');
    expect(evalExtension({ ...t, nowMs: at(17, 58, 59) }).inWindow).toBe(false);
  });

  it('caps the close when Y is bigger than the room left', () => {
    const e = evalExtension({ ...base, trig: 'BID_RECEIVED', extMin: 120 });
    expect(e).toMatchObject({ outcome: 'CAPPED', newCloseMs: at(19) });
  });
});
