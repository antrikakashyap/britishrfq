# Frontend

React 18, TypeScript and Vite. No UI library: the styles are in `src/styles.css`.

```text
src/pages/        Listing, Details, Create
src/components/   Timeline, PriceChart, Leaderboard, BidForm, Activity, Toast
src/hooks.ts      server-synced clock, live data (event stream + polling)
src/api.ts        typed client for the REST API
src/lib/          formatting and client-side validation
src/test/         component tests
```

In development Vite proxies `/api` to `http://localhost:8080`. Run from the repository root with `npm run dev`.
