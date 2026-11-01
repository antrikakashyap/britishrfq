# Security policy

## Reporting a problem

If you find a security issue, please open a private security advisory on GitHub
(Security tab, "Report a vulnerability") instead of a public issue. Include steps to reproduce.

## What is already in place

- Every request body is validated (Zod) before it reaches the rules.
- All SQL uses bound parameters. There is no string-built SQL.
- Security headers (helmet), a 32 KB body limit and a per-IP write rate limit.
- Errors never include stack traces.
- `npm audit` reports 0 known vulnerabilities at the time of writing.

## Known gap

There are no user accounts. Anyone can create an RFQ or bid under any carrier name.
Adding authentication is the first item on the [roadmap](docs/ROADMAP.md).
