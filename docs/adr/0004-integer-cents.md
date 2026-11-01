# ADR 0004: Store money as whole cents

**Status:** Accepted

## Context

Adding decimal numbers in floating point gives results like 0.1 + 0.2 = 0.30000000000000004. Totals decide the ranking, so they must be exact.

## Decision

Store charges as integer cents. Convert to decimals only at the API edge. The total is a generated column in the database. Inputs may have at most two decimal places.

## Consequences

- Sums and comparisons are exact.
- The API shows normal decimal numbers.
- Currencies with more than two decimal places would need a different scale.
