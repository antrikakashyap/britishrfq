# REST API

Base path `/api`. JSON in / JSON out. All instants are ISO-8601 UTC. Money is a decimal number (2 dp) in the RFQ's currency.

Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please fix the highlighted fields",
             "fields": { "forcedBidClose": ["Forced bid close must be later than bid close"] } } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 / 400 | bad payload (field-level `fields`) or invalid JSON |
| `DUPLICATE_REF` | 409 | RFQ reference already used |
| `NOT_FOUND` | 404 | unknown RFQ / endpoint |
| `AUCTION_NOT_STARTED` | 409 | bid before bid start |
| `AUCTION_CLOSED` | 409 | bid at/after the current close (incl. force-closed) |
| `BID_NOT_LOWER` | 422 | supplier's new total is not lower than its own previous total |
| `RATE_LIMITED` | 429 | too many writes from one IP |

| Method & path | Purpose |
|---|---|
| `GET /health`, `GET /time`, `GET /meta` | liveness, server clock, `{demo}` flag |
| `GET /auctions?status=ALL\|ACTIVE\|SCHEDULED\|CLOSED\|FORCE_CLOSED&q=` | **Auction listing**: RFQ name/ID, current lowest bid, current bid close, forced close, status |
| `POST /auctions` | **Create RFQ** with British auction config |
| `GET /auctions/:refId` | **Auction details**: auction + config (X, Y, trigger), ranking (L1…), all bids by price, activity log |
| `POST /auctions/:refId/bids` | **Submit quote**; returns rank and the extension outcome |
| `GET /metrics` | success metrics: bids per RFQ and price improvement, extended vs non-extended |
| `GET /events` | Server-Sent Events: `created`, `bid`, `extended`, `status` |
| `POST /auctions/:refId/simulate` | demo only (`ENABLE_DEMO=1`): a rival carrier bids through the normal path |

### Create RFQ
```json
POST /api/auctions
{ "refId": "RFQ-2026-0001", "name": "Mumbai → Rotterdam, 2×40' FCL", "currency": "USD",
  "pickupDate": "2026-11-20",
  "bidStart": "2026-11-05T10:00:00Z", "bidClose": "2026-11-05T18:00:00Z", "forcedBidClose": "2026-11-05T19:00:00Z",
  "triggerWindowMin": 10, "extensionMin": 5, "triggerType": "BID_RECEIVED" }
```
`triggerType`: `BID_RECEIVED` · `ANY_RANK_CHANGE` · `L1_CHANGE`. Date-times **must** carry a timezone.

### Submit a quote
```json
POST /api/auctions/RFQ-2026-0001/bids
{ "carrierName": "Maersk Line", "freightCharges": 3500, "originCharges": 500, "destinationCharges": 400,
  "transitTimeDays": 21, "quoteValidityDays": 14 }
```
Response (201):
```json
{ "bidId": 12, "rank": 1, "rankLabel": "L1", "suppliers": 4,
  "extension": { "outcome": "EXTENDED", "extended": true,
                 "previousClose": "2026-11-05T18:00:00.000Z", "newClose": "2026-11-05T18:05:00.000Z" },
  "auction": { "...": "same shape as GET /auctions/:refId" } }
```
`outcome` is `NONE`, `EXTENDED`, `CAPPED` (clipped to the forced close) or `BLOCKED` (already at the forced close).
