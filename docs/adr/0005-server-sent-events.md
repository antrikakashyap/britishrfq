# ADR 0005: Use Server-Sent Events for live updates

**Status:** Accepted

## Context

People watching an auction need to see new bids and time extensions without refreshing. The updates only go from server to browser.

## Decision

Use a Server-Sent Events stream at `/api/events`. The server sends a small event (`bid`, `extended`, `status`, `created`) and the page reloads the one auction that changed. A slow poll every 15 seconds is the safety net.

## Consequences

- Much simpler than WebSockets: plain HTTP, automatic reconnect.
- Works through most proxies; if one buffers the stream, polling still keeps the page fresh.
- The event channel lives in memory, so running several servers needs a shared channel (see the roadmap).
