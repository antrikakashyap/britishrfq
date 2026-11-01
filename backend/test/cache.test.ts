import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { at, mkSvc } from './helpers.js';

describe('cache headers', () => {
  it('marks API responses as no-store so a bid is never shown from a cache', async () => {
    const { svc } = mkSvc(at(9));
    const r = await request(createApp({ svc, writeLimit: 0 })).get('/api/auctions');
    expect(r.headers['cache-control']).toBe('no-store');
  });
});
