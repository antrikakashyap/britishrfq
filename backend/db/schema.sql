-- =====================================================================
--  British Auction RFQ  ·  database schema  (SQLite, WAL)
--
--  Conventions
--   * every instant is stored as INTEGER epoch-milliseconds (UTC) so that
--     comparisons / CHECKs are exact and timezone-proof
--   * money is stored as INTEGER minor units (cents) - never floats
--   * the ranking (L1, L2, ...) is DERIVED from bids, never stored, so it
--     can't drift out of sync with the bids it describes
-- =====================================================================
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------
--  rfqs : one row per Request-for-Quotation (= one British auction)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rfqs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_id          TEXT    NOT NULL UNIQUE COLLATE NOCASE,   -- "RFQ Name / Reference ID"
  name            TEXT    NOT NULL,
  description     TEXT,
  currency        TEXT    NOT NULL DEFAULT 'USD',
  pickup_ms       INTEGER NOT NULL,                         -- Pickup / Service date

  bid_start_ms    INTEGER NOT NULL,                         -- Bid Start
  bid_close_ms    INTEGER NOT NULL,                         -- CURRENT Bid Close (moves on extension)
  orig_close_ms   INTEGER NOT NULL,                         -- Bid Close as originally configured
  forced_close_ms INTEGER NOT NULL,                         -- Forced Bid Close (hard ceiling)

  trigger_window_min INTEGER NOT NULL,                      -- X : monitoring window
  extension_min      INTEGER NOT NULL,                      -- Y : minutes added per trigger
  trigger_type       TEXT    NOT NULL,                      -- what causes an extension

  status          TEXT    NOT NULL DEFAULT 'SCHEDULED',     -- persisted lifecycle state
  extension_count INTEGER NOT NULL DEFAULT 0,
  created_ms      INTEGER NOT NULL,
  closed_ms       INTEGER,                                  -- when it actually ended

  CHECK (trigger_type IN ('BID_RECEIVED','ANY_RANK_CHANGE','L1_CHANGE')),
  CHECK (status       IN ('SCHEDULED','ACTIVE','CLOSED','FORCE_CLOSED')),
  CHECK (trigger_window_min > 0),
  CHECK (extension_min      > 0),
  CHECK (bid_close_ms  > bid_start_ms),
  -- VALIDATION RULE 1: forced close strictly later than (original) bid close
  CHECK (forced_close_ms > orig_close_ms),
  -- VALIDATION RULE 2: an extension can never push the close past the forced close
  CHECK (bid_close_ms >= orig_close_ms AND bid_close_ms <= forced_close_ms)
);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs (status, bid_close_ms);

-- ---------------------------------------------------------------------
--  suppliers : a carrier / bidder identity
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,                              -- "Carrier Name" as first typed
  name_key   TEXT    NOT NULL UNIQUE,                       -- lower(trim(name)), identity key
  created_ms INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
--  bids : append-only quote submissions (immutable once written)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bids (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id            INTEGER NOT NULL REFERENCES rfqs (id)      ON DELETE CASCADE,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  freight_cents     INTEGER NOT NULL CHECK (freight_cents     >= 0),
  origin_cents      INTEGER NOT NULL CHECK (origin_cents      >= 0),
  destination_cents INTEGER NOT NULL CHECK (destination_cents >= 0),
  total_cents       INTEGER GENERATED ALWAYS AS
                      (freight_cents + origin_cents + destination_cents) STORED,
  transit_days      INTEGER NOT NULL CHECK (transit_days  BETWEEN 1 AND 365),
  validity_days     INTEGER NOT NULL CHECK (validity_days BETWEEN 1 AND 365),
  created_ms        INTEGER NOT NULL,
  CHECK (freight_cents + origin_cents + destination_cents > 0)
);
-- leaderboard / ranking scan + "previous bid of this supplier" lookup
CREATE INDEX IF NOT EXISTS idx_bids_rfq_total ON bids (rfq_id, total_cents, created_ms);
CREATE INDEX IF NOT EXISTS idx_bids_rfq_sup   ON bids (rfq_id, supplier_id, created_ms);
-- a supplier's best bid (ranking) = first row of this index per (rfq, supplier)
CREATE INDEX IF NOT EXISTS idx_bids_best      ON bids (rfq_id, supplier_id, total_cents, created_ms);

-- ---------------------------------------------------------------------
--  activity_log : append-only audit trail shown on the details page
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id        INTEGER NOT NULL REFERENCES rfqs (id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL,
  message       TEXT    NOT NULL,                           -- human readable line
  reason        TEXT,                                       -- WHY (extension reason etc.)
  supplier_id   INTEGER REFERENCES suppliers (id),
  bid_id        INTEGER REFERENCES bids (id),
  old_close_ms  INTEGER,                                    -- extensions: close before
  new_close_ms  INTEGER,                                    -- extensions: close after
  created_ms    INTEGER NOT NULL,                           -- logical time of the event
  CHECK (kind IN ('RFQ_CREATED','AUCTION_STARTED','BID_SUBMITTED','TIME_EXTENDED',
                  'EXTENSION_CAPPED','EXTENSION_BLOCKED','AUCTION_CLOSED','AUCTION_FORCE_CLOSED'))
);
CREATE INDEX IF NOT EXISTS idx_log_rfq ON activity_log (rfq_id, created_ms, id);
