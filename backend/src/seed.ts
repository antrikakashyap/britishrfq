import { openDb, type Db } from './db.js';
import { AuctionService } from './service.js';
import { resolve } from 'node:path';

const M = 60_000;
type Cfg = {
  ref: string; name: string; cur: string; desc: string;
  start: number; close: number; forced: number; x: number; y: number;
  trig: 'BID_RECEIVED' | 'ANY_RANK_CHANGE' | 'L1_CHANGE';
  pickDays: number;
  /** [minutes relative to "now", carrier, total] - must be chronological */
  bids: [number, string, number][];
};

const SEEDS: Cfg[] = [
  {
    ref: 'RFQ-2026-MUM-RTM-0147', name: "Mumbai (JNPT) → Rotterdam · 2 × 40' FCL", cur: 'USD',
    desc: 'Electronics components, palletised. Door-to-port, CIF terms. Live right now and inside its trigger window - place a bid to watch the auction extend.',
    start: -180, close: -3, forced: 90, x: 20, y: 10, trig: 'L1_CHANGE', pickDays: 12,
    bids: [
      [-170, 'Maersk Line', 4850], [-120, 'MSC Cargo', 4720], [-60, 'CMA CGM', 4690], [-30, 'Maersk Line', 4610],
      [-22, 'MSC Cargo', 4540], // L1 change inside the window -> extends
      [-8, 'Hapag-Lloyd', 4490], // new L1 inside the window -> extends again
      [-2, 'CMA CGM', 4510], // rank change but NOT L1 -> no extension under the L1 trigger
    ],
  },
  {
    ref: 'RFQ-2026-SHA-LAX-0212', name: "Shanghai → Los Angeles · 20' FCL", cur: 'USD',
    desc: 'Consumer goods, 18 t. Any bid in the last 15 minutes extends the auction by 10.',
    start: -300, close: 180, forced: 360, x: 15, y: 10, trig: 'BID_RECEIVED', pickDays: 20,
    bids: [
      [-280, 'Evergreen Marine', 3320], [-240, 'ONE Express', 3260], [-190, 'COSCO Shipping', 3185],
      [-120, 'Evergreen Marine', 3110], [-45, 'ONE Express', 3090], [-20, 'Yang Ming', 3075],
    ],
  },
  {
    ref: 'RFQ-2026-BLR-FRA-0301', name: 'Bengaluru → Frankfurt · Air freight 1.2 t', cur: 'EUR',
    desc: 'Time-critical machine parts. Any change in supplier ranking in the last 20 minutes extends by 10.',
    start: -90, close: 45, forced: 120, x: 20, y: 10, trig: 'ANY_RANK_CHANGE', pickDays: 5,
    bids: [[-70, 'Lufthansa Cargo', 6120], [-50, 'Emirates SkyCargo', 5980], [-25, 'Qatar Airways Cargo', 5890]],
  },
  {
    ref: 'RFQ-2026-MAA-SIN-0388', name: 'Chennai → Singapore · LCL consolidation', cur: 'USD',
    desc: 'Opens soon. 14 CBM mixed cargo, weekly sailing.',
    start: 120, close: 480, forced: 600, x: 10, y: 5, trig: 'L1_CHANGE', pickDays: 9, bids: [],
  },
  {
    ref: 'RFQ-2026-DEL-DXB-0099', name: 'Delhi → Dubai · Air freight 800 kg', cur: 'AED',
    desc: 'Closed normally: no bid landed inside the trigger window, so there was never an extension.',
    start: -1500, close: -1440, forced: -1380, x: 10, y: 5, trig: 'BID_RECEIVED', pickDays: -20,
    bids: [[-1490, 'Emirates SkyCargo', 11800], [-1470, 'Etihad Cargo', 11450], [-1452, 'Emirates SkyCargo', 11200]],
  },
  {
    ref: 'RFQ-2026-CCU-HAM-0120', name: 'Kolkata → Hamburg · 3 × 40\' HC', cur: 'EUR',
    desc: 'Closed after two extensions - both well before the Forced Close.',
    start: -2000, close: -1000, forced: -900, x: 10, y: 10, trig: 'L1_CHANGE', pickDays: -14,
    bids: [
      [-1900, 'Hapag-Lloyd', 7900], [-1500, 'MSC Cargo', 7740], [-1100, 'Maersk Line', 7690],
      [-1004, 'CMA CGM', 7580], [-995, 'Hapag-Lloyd', 7495],
    ],
  },
  {
    ref: 'RFQ-2026-NSA-FXT-0066', name: "Nhava Sheva → Felixstowe · 40' reefer", cur: 'USD',
    desc: 'Force-closed: bidders kept leapfrogging each other until the auction hit its Forced Bid Close.',
    start: -420, close: -300, forced: -285, x: 10, y: 6, trig: 'BID_RECEIVED', pickDays: -10,
    bids: [
      [-400, 'MSC Cargo', 5400], [-340, 'Maersk Line', 5290], [-308, 'CMA CGM', 5240],
      [-296, 'MSC Cargo', 5190], [-289, 'Maersk Line', 5120], [-286, 'CMA CGM', 5075],
    ],
  },
];

const split = (t: number) => {
  const fr = Math.round(t * 0.8 * 100) / 100;
  const og = Math.round(t * 0.12 * 100) / 100;
  return { freightCharges: fr, originCharges: og, destinationCharges: Math.round((t - fr - og) * 100) / 100 };
};

/** Builds believable history with a fake clock, going through the real service code paths. */
export function seedDemo(db: Db, base = Date.now()): void {
  let t = base;
  const svc = new AuctionService(db, () => t);
  const iso = (m: number) => new Date(base + m * M).toISOString();
  SEEDS.forEach((c, i) => {
    t = base + (c.start - 30) * M;
    svc.createRfq({
      refId: c.ref, name: c.name, description: c.desc, currency: c.cur,
      pickupDate: iso(c.pickDays * 1440).slice(0, 10),
      bidStart: iso(c.start), bidClose: iso(c.close), forcedBidClose: iso(c.forced),
      triggerWindowMin: c.x, extensionMin: c.y, triggerType: c.trig,
    });
    c.bids.forEach(([at, nm, tot], j) => {
      t = base + at * M;
      svc.placeBid(c.ref, { carrierName: nm, ...split(tot), transitTimeDays: 14 + ((i * 3 + j * 5) % 19), quoteValidityDays: [7, 14, 21, 30][(i + j) % 4] });
    });
  });
  t = base;
  svc.settleAll();
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  const path = process.env['DB_PATH'] ?? resolve('data/rfq.db');
  const db = openDb(path);
  db.exec('DELETE FROM activity_log; DELETE FROM bids; DELETE FROM suppliers; DELETE FROM rfqs;');
  seedDemo(db);
  console.log(`Seeded ${SEEDS.length} demo auctions into ${path}`);
}
