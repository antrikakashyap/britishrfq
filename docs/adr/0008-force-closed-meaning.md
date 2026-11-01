# ADR 0008: Force closed means the close equals the forced close

**Status:** Accepted

## Context

The brief lists Active, Closed and Force Closed but does not say exactly when an auction counts as force closed.

## Decision

Status is a pure function of time. When the current close has passed: if it is earlier than the forced close the status is Closed, if it equals the forced close the status is Force closed. A trigger that fires when the close is already at the forced close is logged as `EXTENSION_BLOCKED`.

## Consequences

- The status can always be worked out from the times, so it can never disagree with them.
- Refused extensions are still visible in the activity log.
