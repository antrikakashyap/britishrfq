# ADR 0002: Only the server keeps time

**Status:** Accepted

## Context

Whether a bid is early enough, inside the trigger window or too late decides who wins and whether the auction extends. A browser clock can be wrong or changed on purpose.

## Decision

The server reads the clock once per bid and uses that single timestamp for every check. The browser only displays a countdown, corrected by the `serverTime` that comes back with every response.

## Consequences

- Fair and cheat-resistant.
- Rules take `now` as an argument, so tests can set any time without waiting.
- A bid arriving at the exact close is rejected, because the server decides.
