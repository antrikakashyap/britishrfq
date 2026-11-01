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

  it('treats a new supplier joining at the last place as a rank change', () => {
    const e = evalExtension({ ...base, trig: 'ANY_RANK_CHANGE', before: rk([1, 100]), after: rk([1, 100], [2, 200]) });
    expect(e).toMatchObject({ fired: true, outcome: 'EXTENDED' });
  });

  it('does not treat a new supplier below the leader as an L1 change', () => {
    const e = evalExtension({ ...base, trig: 'L1_CHANGE', before: rk([1, 100]), after: rk([1, 100], [2, 200]) });
    expect(e).toMatchObject({ inWindow: true, fired: false, outcome: 'NONE' });
  });

  it('counts the very first bid as an L1 change', () => {
    const e = evalExtension({ ...base, trig: 'L1_CHANGE', before: [], after: rk([1, 100]) });
    expect(e.outcome).toBe('EXTENDED');
  });

  it('blocks all three triggers once the close already equals the forced close', () => {
    for (const trig of ['BID_RECEIVED', 'ANY_RANK_CHANGE', 'L1_CHANGE'] as const) {
      const e = evalExtension({ ...base, trig, closeMs: at(19), nowMs: at(18, 55) });
      expect(e).toMatchObject({ outcome: 'BLOCKED', newCloseMs: at(19) });
    }
  });

  it('reports where the trigger window starts', () => {
    expect(evalExtension({ ...base, trig: 'BID_RECEIVED' }).windowStartMs).toBe(at(17, 50));
  });

  it('is outside the window when now equals the close', () => {
    expect(evalExtension({ ...base, trig: 'BID_RECEIVED', nowMs: at(18) })).toMatchObject({ inWindow: false, outcome: 'NONE' });
  });
});
