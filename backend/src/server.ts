import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { AuctionService } from './service.js';
import { createApp } from './http/app.js';
import { seedDemo } from './seed.js';

const port = Number(process.env['PORT'] ?? 8080);
const dbPath = process.env['DB_PATH'] ?? resolve('data/rfq.db');
const demo = process.env['ENABLE_DEMO'] ? process.env['ENABLE_DEMO'] === '1' : process.env['NODE_ENV'] !== 'production';
const webDir = process.env['WEB_DIR'] ?? fileURLToPath(new URL('../../frontend/dist', import.meta.url));

const db = openDb(dbPath);
const svc = new AuctionService(db);
if (demo && process.env['SEED_ON_EMPTY'] !== '0' && svc.list().length === 0) seedDemo(db);

// sweeper: moves auctions SCHEDULED -> ACTIVE -> CLOSED / FORCE_CLOSED on time, even with no traffic
const tick = setInterval(() => svc.settleAll(), 1000);
tick.unref();

const srv = createApp({ svc, demo, webDir }).listen(port, () =>
  console.log(`British Auction RFQ API on http://localhost:${port}  (demo=${demo}, db=${dbPath})`),
);
const stop = () => {
  clearInterval(tick);
  srv.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
