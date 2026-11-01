import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { at, isoAt, mkSvc } from './helpers.js';

describe('health check', () => {
  it('reports ok, the server time and how long the process has been up', async () => {
    const { svc } = mkSvc(at(9));
    const r = await request(createApp({ svc, writeLimit: 0 })).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', time: isoAt(9) });
    expect(r.body.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
