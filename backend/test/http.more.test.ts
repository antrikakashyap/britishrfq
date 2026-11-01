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

  it('filters the list by status', async () => {
    const { api, set } = boot();
    await api.post('/api/auctions').send(rfqBody());
    await api.post('/api/auctions').send(rfqBody({ refId: 'RFQ-T-2', bidStart: isoAt(11) }));
    set(at(10, 30)); // the first RFQ is open, the second has not started
    const r = await api.get('/api/auctions?status=SCHEDULED');
    expect(r.body.map((a: { refId: string }) => a.refId)).toEqual(['RFQ-T-2']);
    expect((await api.get('/api/auctions?status=ACTIVE')).body.map((a: { refId: string }) => a.refId)).toEqual(['RFQ-T-1']);
  });

  it('searches by name or reference, ignoring letter case', async () => {
    const { api } = boot();
    await api.post('/api/auctions').send(rfqBody({ name: 'Mumbai lane' }));
    await api.post('/api/auctions').send(rfqBody({ refId: 'RFQ-T-2', name: 'Chennai lane' }));
    expect((await api.get('/api/auctions?q=MUMBAI')).body).toHaveLength(1);
    expect((await api.get('/api/auctions?q=rfq-t-2')).body[0].name).toBe('Chennai lane');
  });

  it('returns the total bid count and the full price history on the details route', async () => {
    const { api, set } = boot();
    await api.post('/api/auctions').send(rfqBody());
    set(at(12));
    await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('Maersk', 1000));
    await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('Maersk', 990));
    const d = (await api.get('/api/auctions/RFQ-T-1?bids=1')).body;
    expect(d.bids).toHaveLength(1);
    expect(d.bidsTotal).toBe(2);
    expect(d.history).toHaveLength(2);
  });
});
