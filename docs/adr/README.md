# Architecture decision records

Short pages that explain why things are the way they are. Each has the same shape: context, decision, consequences.

| # | Decision |
| --- | --- |
| [0001](0001-sqlite.md) | Use SQLite for storage |
| [0002](0002-server-side-clock.md) | Only the server keeps time |
| [0003](0003-derived-ranking.md) | Work out the ranking, never store it |
| [0004](0004-integer-cents.md) | Store money as whole cents |
| [0005](0005-server-sent-events.md) | Use Server-Sent Events for live updates |
| [0006](0006-forced-close-in-database.md) | Enforce the forced close in code and in the database |
| [0007](0007-trigger-semantics.md) | Define "rank change" and "L1 change" precisely |
| [0008](0008-force-closed-meaning.md) | Force closed means the close equals the forced close |
