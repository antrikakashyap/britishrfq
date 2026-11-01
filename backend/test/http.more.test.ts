import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { at, bidBody, isoAt, mkSvc, rfqBody } from './helpers.js';

function boot() {
  const k = mkSvc(at(9));
  return { ...k, api: request(createApp({ svc: k.svc, demo: false, writeLimit: 0 })) };
}

describe('REST API details', () => {
  it('reports the server time and that the demo helper is off', async () => {
    const { api } = boot();
    expect((await api.get('/api/time')).body).toEqual({ serverTime: isoAt(9) });
    expect((await api.get('/api/meta')).body.demo).toBe(false);
  });
});
