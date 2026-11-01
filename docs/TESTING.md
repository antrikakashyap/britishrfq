# Testing guide

## Everything at once

```bash
npm test            # backend + frontend
npm run typecheck
```

## What each layer proves

| Layer | Where | What it proves |
| --- | --- | --- |
| Rules | `backend/test/domain.test.ts` | Ranking, the three triggers, the forced-close cap and status, to the millisecond, with no database and no real clock |
| Service | `backend/test/service.test.ts` | A real in-memory database, a fake clock, the brief's own 6:00 PM examples, validation and logs |
| REST API | `backend/test/http.test.ts` | Status codes, error shapes, the full bid flow over HTTP |
| Screens | `frontend/src/test/` | The timeline, ranking table, activity log, chart, bid form and pages (React Testing Library) |
| Real time | `scripts/e2e-live.mjs` | Real auctions that run about 3.5 minutes; proves the extensions work on a real clock |
| Accessibility | `scripts/a11y.cjs` | axe-core WCAG 2.1 A/AA on every page, desktop and mobile |

## How time is tested

The rules never read the clock. They take `now` as an argument, so a test can say "a bid arrives at 5:55 PM" and check the result without waiting.
`backend/test/helpers.ts` has `at(h, m)` to build times on a fixed day and `mkSvc()` to make a service with a clock you control.

## Running the real-time check

```bash
npm run build && npm start &          # in one terminal
npm run e2e                           # about 3.5 minutes
BASE=https://your-site.example npm run e2e   # against a deployed copy
```

## Running the accessibility scan

```bash
npm i --no-save playwright axe-core
npx playwright install chromium
node scripts/a11y.cjs                 # the app must be running on :8080
```
