import { describe, expect, it } from 'vitest';
import { serverNow, syncClock } from '../api';

describe('server clock', () => {
  it('follows the server time instead of the local clock', () => {
    const ahead = Date.now() + 3_600_000;
    syncClock(new Date(ahead).toISOString());
    expect(Math.abs(serverNow() - ahead)).toBeLessThan(200);
    syncClock(new Date().toISOString()); // put it back
  });

  it('keeps the last offset when a response has no server time', () => {
    syncClock(new Date(Date.now() + 5000).toISOString());
    const before = serverNow();
    syncClock(undefined);
    expect(Math.abs(serverNow() - before)).toBeLessThan(200);
    syncClock(new Date().toISOString());
  });
});
