# Changelog

All notable changes. Newest first.

## 1.1.0

- Faster ranking: only each supplier's best bid is read; about 4 times faster at 3,000 bids.
- The details page caps the bids table (200 rows, "Show all") and the activity log (latest 300); the chart still gets the full history.
- JSON errors for oversized bodies (413) and malformed URLs (400) instead of 500.
- Better contrast for secondary text; the activity log can be scrolled with the keyboard.
- Dependencies upgraded (zod 4, vitest 5, react-router 7): `npm audit` reports 0 issues.
- Added component tests and an accessibility scan.

## 1.0.0

- RFQ creation with forced close, bid close, trigger window X, extension Y and three trigger types.
- Bidding with ranking (L1, L2, ...), automatic extension and the forced-close ceiling.
- Listing and details pages with activity log and the reason for each extension.
- Live updates, demo data, metrics, Render blueprint, Docker, CI.
