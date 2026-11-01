# ADR 0001: Use SQLite for storage

**Status:** Accepted

## Context

The brief needs a database with real transactions, but the project has to be easy to install, review and host for free. Running a separate database server adds setup for every reader.

## Decision

Use SQLite through the `node:sqlite` module that ships with Node 22. Turn on WAL mode and foreign keys. Keep the schema in one file, `backend/db/schema.sql`.

## Consequences

- Nothing extra to install; tests use an in-memory database.
- One writer at a time, which matches the need to handle bids for one RFQ one after another.
- It limits the app to one server. The schema was written to move to Postgres later without redesign (see the HLD, section 6).
- `node:sqlite` is still marked experimental, so the start scripts silence that warning.
