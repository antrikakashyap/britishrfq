import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { at, bidBody, isoAt, mkSvc, rfqBody } from './helpers.js';

function boot() {
  const k = mkSvc(at(9));
  const app = createApp({ svc: k.svc, demo: true, writeLimit: 0 });
  return { ...k, api: request(app) };
}

describe('REST API', () => {
  it('GET /api/health & /api/meta', async () => {
    const { api } = boot();
    expect((await api.get('/api/health')).body.status).toBe('ok');
    expect((await api.get('/api/meta')).body).toMatchObject({ demo: true, serverTime: isoAt(9) });
  });

  it('POST /api/auctions -> 201, then 422 with field errors, then 409 on duplicate', async () => {
    const { api } = boot();
    const ok = await api.post('/api/auctions').send(rfqBody());
    expect(ok.status).toBe(201);
    expect(ok.body.auction).toMatchObject({ refId: 'RFQ-T-1', status: 'SCHEDULED', config: { triggerWindowMin: 10, extensionMin: 5, triggerType: 'BID_RECEIVED' } });

    const bad = await api.post('/api/auctions').send(rfqBody({ refId: 'RFQ-T-2', forcedBidClose: isoAt(17) }));
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.fields.forcedBidClose[0]).toMatch(/later than bid close/);

    expect((await api.post('/api/auctions').send(rfqBody())).status).toBe(409);
    expect((await api.post('/api/auctions').set('Content-Type', 'application/json').send('{oops')).status).toBe(400);
  });

  it('full flow: bid -> extension -> details -> list', async () => {
    const { api, set } = boot();
    await api.post('/api/auctions').send(rfqBody());
    set(at(17, 56));
    const bid = await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('Maersk', 1234.56));
    expect(bid.status).toBe(201);
    expect(bid.body).toMatchObject({ rankLabel: 'L1', extension: { extended: true, newClose: isoAt(18, 5) } });

    const det = await api.get('/api/auctions/RFQ-T-1');
    expect(det.body.ranking[0]).toMatchObject({ label: 'L1', carrierName: 'Maersk', total: 1234.56 });
    expect(det.body.activity.map((a: { kind: string }) => a.kind)).toEqual(['RFQ_CREATED', 'AUCTION_STARTED', 'BID_SUBMITTED', 'TIME_EXTENDED']);

    const list = await api.get('/api/auctions?status=ACTIVE');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ refId: 'RFQ-T-1', status: 'ACTIVE', lowestBid: { total: 1234.56 }, bidClose: isoAt(18, 5), forcedBidClose: isoAt(19) });
  });

  it('bid errors: 422 validation, 422 not lower, 409 closed, 404 unknown', async () => {
    const { api, set } = boot();
    await api.post('/api/auctions').send(rfqBody());
    set(at(12));
    expect((await api.post('/api/auctions/RFQ-T-1/bids').send({ carrierName: 'A' })).status).toBe(422);
    await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('A', 500));
    const nl = await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('A', 600));
    expect(nl.status).toBe(422);
    expect(nl.body.error.code).toBe('BID_NOT_LOWER');
    expect((await api.post('/api/auctions/NOPE/bids').send(bidBody('A', 1))).status).toBe(404);
    set(at(18, 1));
    const closed = await api.post('/api/auctions/RFQ-T-1/bids').send(bidBody('B', 1));
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('AUCTION_CLOSED');
  });

  it('demo simulate places a legal rival bid; /metrics responds; unknown route is JSON 404', async () => {
    const { api, set } = boot();
    await api.post('/api/auctions').send(rfqBody());
    set(at(12));
    const sim = await api.post('/api/auctions/RFQ-T-1/simulate');
    expect(sim.status).toBe(201);
    expect(sim.body.auction.auction.bidCount).toBe(1);
    for (let i = 0; i < 15; i++) expect((await api.post('/api/auctions/RFQ-T-1/simulate')).status).toBe(201);
    expect((await api.get('/api/metrics')).body.bids.total).toBe(16);
    const nf = await api.get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
  });
});
