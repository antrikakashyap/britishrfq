import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { rivalBid } from '../demo.js';
import { AppError } from '../errors.js';
import type { AuctionService, LiveEvent } from '../service.js';

export interface AppOpts {
  svc: AuctionService;
  demo?: boolean;
  /** folder with the built frontend; served as an SPA when it exists */
  webDir?: string;
  /** requests/minute/IP on write endpoints (0 disables - used by tests) */
  writeLimit?: number;
}

const wrap = (f: (q: Request, s: Response) => unknown) => (q: Request, s: Response) => s.json(f(q, s));
const key = (q: Request): string => String(q.params['key']);

export function createApp({ svc, demo = false, webDir, writeLimit = 120 }: AppOpts) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '32kb' }));

  const api = express.Router();

  if (writeLimit > 0)
    api.use(
      rateLimit({
        windowMs: 60_000,
        limit: writeLimit,
        skip: (q) => q.method === 'GET',
        handler: (_q, _s, next) => next(new AppError('RATE_LIMITED', 429, 'Too many requests - slow down a little')),
      }),
    );

  api.get('/health', wrap(() => ({ status: 'ok', time: new Date(svc.now()).toISOString() })));
  api.get('/meta', wrap(() => ({ demo, serverTime: new Date(svc.now()).toISOString() })));
  api.get('/time', wrap(() => ({ serverTime: new Date(svc.now()).toISOString() })));
  api.get('/metrics', wrap(() => svc.metrics()));

  api.get('/auctions', wrap((q) => svc.list({ status: String(q.query['status'] ?? ''), q: String(q.query['q'] ?? '') })));
  api.post('/auctions', (q, s) => s.status(201).json(svc.createRfq(q.body)));
  api.get('/auctions/:key', wrap((q) => {
    const b = String(q.query['bids'] ?? '');
    return svc.details(key(q), { bids: b === 'all' ? 'all' : /^\d+$/.test(b) ? Number(b) : undefined });
  }));
  api.post('/auctions/:key/bids', (q, s) => s.status(201).json(svc.placeBid(key(q), q.body)));

  api.post('/auctions/:key/simulate', (q, s) => {
    if (!demo) throw new AppError('DEMO_DISABLED', 403, 'Demo helpers are disabled (set ENABLE_DEMO=1)');
    s.status(201).json(rivalBid(svc, key(q)));
  });

  // Server-Sent Events: the UI refetches whenever something changes (no polling storms).
  let sse = 0;
  api.get('/events', (q, s) => {
    if (sse >= 500) throw new AppError('RATE_LIMITED', 503, 'Too many live connections - try again shortly');
    sse++;
    s.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    s.flushHeaders();
    s.write('retry: 2000\n\n');
    const on = (e: LiveEvent) => s.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    const ping = setInterval(() => s.write(': ping\n\n'), 20_000);
    svc.bus.on('event', on);
    q.on('close', () => {
      sse--;
      clearInterval(ping);
      svc.bus.off('event', on);
    });
  });

  api.use((q) => {
    throw new AppError('NOT_FOUND', 404, `No such endpoint: ${q.method} ${q.originalUrl}`);
  });
  app.use('/api', api);

  if (webDir && existsSync(join(webDir, 'index.html'))) {
    app.use(express.static(webDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_q, s) => s.sendFile(join(webDir, 'index.html')));
  }

  const onErr: ErrorRequestHandler = (e, _q, s, _n) => {
    if (e instanceof AppError) {
      s.status(e.status).json({ error: { code: e.code, message: e.message, fields: e.fields } });
      return;
    }
    if (e?.type === 'entity.parse.failed' || e instanceof SyntaxError) {
      s.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
      return;
    }
    // client errors raised by Express / body-parser (too large, malformed URL, bad charset, ...)
    const st = Number(e?.status ?? e?.statusCode);
    if (st >= 400 && st < 500) {
      const big = st === 413;
      s.status(st).json({
        error: {
          code: big ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          message: big ? 'Request body is too large' : 'The request could not be understood',
        },
      });
      return;
    }
    console.error(e);
    s.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  };
  app.use(onErr);
  return app;
}
