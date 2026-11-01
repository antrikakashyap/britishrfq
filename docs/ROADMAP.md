# Roadmap

What comes next, in the order that matters most. Nothing here is promised; it is where the project would go.

## 1. Accounts and roles
- Buyer and supplier logins.
- A supplier can only bid as its own company (today the carrier name is typed in).
- Only the buyer who owns an RFQ can see its settings.

## 2. Buyer actions
- Award the winning bid when an auction ends.
- Cancel or pause an auction before it starts.
- Download the final ranking as a file.

## 3. Scale
- Move from SQLite to Postgres (the schema ports one to one, see `docs/HLD.md` section 6).
- Replace the in-memory live-update channel with a shared one so many servers can run.
- One scheduled job per auction close, instead of a one-second sweep.

## 4. Notifications
- Tell a supplier when it is outbid, when time is added, and when an auction is about to close.

## 5. Nice to have
- Minimum price step between bids.
- Reserve price (a ceiling the buyer will not go above).
- Per-lane templates for creating RFQs faster.
