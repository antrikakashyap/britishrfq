# ADR 0006: Enforce the forced close in code and in the database

**Status:** Accepted

## Context

The most important promise in the brief is that an auction never goes past its forced close. A bug in the application code must not be able to break it.

## Decision

The rules clamp every new close to the forced close. In addition the table has `CHECK (forced_close_ms > orig_close_ms)` and `CHECK (bid_close_ms >= orig_close_ms AND bid_close_ms <= forced_close_ms)`.

## Consequences

- Two independent layers protect the rule.
- A violation fails loudly with a database error instead of silently saving bad data.
- The checks are part of the schema file, so they are easy to review.
