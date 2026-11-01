# ADR 0007: Define "rank change" and "L1 change" precisely

**Status:** Accepted

## Context

The brief names three triggers but leaves some cases open: Does a new supplier joining count as a rank change? Does the very first bid count as an L1 change?

## Decision

A **rank change** means the ordered list of suppliers changed: someone moved up or a new supplier joined. Lowering a price without changing anyone's place is not a rank change. An **L1 change** means a different supplier is now lowest; the first bid counts, because before it nobody was L1. The window is `[close - X, close)`.

## Consequences

- The behaviour is the same every time and easy to explain.
- Each rule is one small function in `backend/src/domain/` with tests, so a different reading is a small change.
