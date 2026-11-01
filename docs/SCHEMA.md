# Database schema

Source of truth: [`backend/db/schema.sql`](../backend/db/schema.sql) (applied automatically on start).

```mermaid
erDiagram
  rfqs ||--o{ bids : "receives"
  rfqs ||--o{ activity_log : "records"
  suppliers ||--o{ bids : "places"
  suppliers |o--o{ activity_log : "caused"
  bids |o--o{ activity_log : "about"

  rfqs {
    int id PK
    text ref_id UK "RFQ Name / Reference ID"
    text name
    text description
    text currency
    int pickup_ms "Pickup / Service date"
    int bid_start_ms
    int bid_close_ms "CURRENT close - moves on extension"
    int orig_close_ms "close as configured"
    int forced_close_ms "hard ceiling"
    int trigger_window_min "X"
    int extension_min "Y"
    text trigger_type "BID_RECEIVED | ANY_RANK_CHANGE | L1_CHANGE"
    text status "SCHEDULED | ACTIVE | CLOSED | FORCE_CLOSED"
    int extension_count
    int created_ms
    int closed_ms
  }
  suppliers {
    int id PK
    text name
    text name_key UK "lower(trim(name))"
    int created_ms
  }
  bids {
    int id PK
    int rfq_id FK
    int supplier_id FK
    int freight_cents
    int origin_cents
    int destination_cents
    int total_cents "GENERATED = sum of the three"
    int transit_days
    int validity_days
    int created_ms
  }
  activity_log {
    int id PK
    int rfq_id FK
    text kind
    text message
    text reason "why an extension happened"
    int supplier_id FK
    int bid_id FK
    int old_close_ms
    int new_close_ms
    int created_ms "logical event time"
  }
```

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `rfqs` | One row per RFQ / auction incl. its British-auction configuration (X, Y, trigger) | `bid_close_ms` is the live close; `orig_close_ms` is kept so the UI can show how much time extensions added |
| `suppliers` | Bidder identity (carrier) | Unique on normalised name, so "Maersk  LINE" = "maersk line" |
| `bids` | Append-only quote submissions | `total_cents` is a **generated stored column** - can never disagree with its parts |
| `activity_log` | Immutable audit trail: bids, extensions (with reason), caps, blocked attempts, start/close | `created_ms` is the *logical* time, so a close at 6:00 PM reads 6:00 PM even if processed later |

## Integrity rules enforced **in the database**

| Rule (spec §7) | Constraint |
|---|---|
| Forced close must be later than bid close | `CHECK (forced_close_ms > orig_close_ms)` |
| An extension never goes beyond forced close | `CHECK (bid_close_ms >= orig_close_ms AND bid_close_ms <= forced_close_ms)` |
| Bidding period is positive | `CHECK (bid_close_ms > bid_start_ms)` |
| X and Y are positive | `CHECK (trigger_window_min > 0)`, `CHECK (extension_min > 0)` |
| Valid trigger / status values | `CHECK (... IN (...))` |
| Non-negative charges, positive total, sane transit / validity | `CHECK` on `bids` |
| Unique RFQ reference (case-insensitive) | `ref_id TEXT UNIQUE COLLATE NOCASE` |

## Indexes

| Index | Serves |
|---|---|
| `idx_bids_rfq_total (rfq_id, total_cents, created_ms)` | leaderboard / lowest-bid lookups |
| `idx_bids_rfq_sup (rfq_id, supplier_id, created_ms)` | "this supplier's previous bid" check |
| `idx_log_rfq (rfq_id, created_ms, id)` | activity log in order |
| `idx_rfqs_status (status, bid_close_ms)` | sweeper & listing filters |

## Ranking is derived, not stored

`L1, L2, …` = suppliers ordered by each supplier's best bid (`total_cents` asc, then earlier `created_ms`, then `id`).
Storing it would create a second source of truth that could go stale between a bid and its re-rank.
