# Contributing

Thanks for taking a look. This project is small on purpose, so the process is short.

## Set up

```bash
npm install
npm run dev        # API on :8080, website on :5173
```

You need Node 22.13 or newer.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run build
```

All three must pass. CI runs the same commands.

## Where things live

| You want to change | Look in |
| --- | --- |
| How ranking, extension or status work | `backend/src/domain/` (small pure functions) |
| What happens on a bid | `backend/src/service.ts` |
| An API route | `backend/src/http/app.ts` |
| The database | `backend/db/schema.sql` |
| A screen | `frontend/src/pages/` and `frontend/src/components/` |

## Ground rules

- **Keep the rules pure.** Code in `backend/src/domain/` takes the time as an argument and never reads the clock. That is what makes it testable to the millisecond.
- **Add a test with every rule change.** The brief's examples are already tests; copy their style.
- **Money is whole cents** inside the system. Decimals only appear at the API edge.
- **Small commits, clear messages.** One idea per commit, in the form `type(scope): what changed`.
