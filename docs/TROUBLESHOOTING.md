# Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find module 'node:sqlite'` | Node is older than 22.13 | Install Node 22.13 or newer (`nvm use` reads `.nvmrc`) |
| Port 8080 already in use | Another copy is running | Stop it, or set `PORT=8090` |
| The page is blank in development | The API is not running | Use `npm run dev` (starts both) |
| Live updates do not arrive | A proxy buffers event streams | The page falls back to polling every 15 seconds; check the proxy allows `text/event-stream` |
| The live site is slow to open | Free plan was asleep | Wait 30 to 60 seconds |
| Demo auctions are all closed | Demo data is created at start and runs on real time | Run `npm run seed` to reset it |
| `429 RATE_LIMITED` | More than 120 writes a minute from one address | Wait a minute |
| `422 VALIDATION_ERROR` when creating an RFQ | A date has no time zone, or forced close is not later than close | Read the `fields` in the response body |
| `409 AUCTION_CLOSED` | The bid arrived at or after the current close | Bid earlier; the close may have moved |
