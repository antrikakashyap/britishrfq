# ADR 0003: Work out the ranking, never store it

**Status:** Accepted

## Context

L1, L2 and L3 change whenever a bid arrives. A stored rank column would be a second copy of the truth that could fall out of date.

## Decision

Compute the ranking from bids. Only each supplier's best bid matters, so the query reads one row per supplier (index `idx_bids_best`). Ties go to the earlier bid.

## Consequences

- The ranking cannot be wrong or stale.
- A bid costs work in proportion to the number of suppliers, not the number of bids (about 13 ms at 3,000 bids).
- Reads recompute the ranking each time; that is cheap at this size.
