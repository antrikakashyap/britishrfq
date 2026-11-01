# Backend

Node 22, TypeScript, Express 5 and SQLite (`node:sqlite`).

```text
src/domain/    pure rules: ranking, extension, status, money, validation
src/service.ts creating RFQs, placing bids, reading, metrics (one transaction per bid)
src/http/      the API routes, error mapping and the live-update stream
src/seed.ts    demo data built through the real code paths with a fake clock
src/demo.ts    the "rival bid" helper used by the demo button
db/schema.sql  tables, constraints and indexes
test/          unit, service and REST tests
```

Run from the repository root: `npm run dev`, `npm test`, `npm run build`.
The API is described in [`docs/API.md`](../docs/API.md) and the tables in [`docs/SCHEMA.md`](../docs/SCHEMA.md).
