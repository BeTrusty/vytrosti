# ADR 0003: Cron-Based Horizon Polling

## Status
Approved

## Context
We need to monitor incoming Stellar payments for leased wallets.
Horizon provides two ways to watch for transactions:
1. **Streaming (Server-Sent Events / EventSource)**: The application opens a persistent connection to Horizon and gets pushed events.
2. **Polling**: The application periodically queries Horizon endpoints for new operations.

Vytrosti is deployed on Vercel (Serverless). Serverless environments do not support long-running processes or open sockets; functions execute in response to HTTP events and terminate after execution.

## Decision
We will use **Cron-Based Polling** via Vercel Cron.
- A Route Handler `/api/cron/poll-payments` is triggered once per minute.
- The handler reads pool wallets in `assigned` and `settling` states.
- It queries Horizon for operations on these wallets starting from their stored `last_horizon_cursor`.
- It processes transactions idempotently, updates cursors, and updates wallet/intent states.

## Consequences
- **Pros**:
  - Fully compatible with Serverless / Vercel hosting.
  - Predictable execution cost and footprint.
  - Resilience: if a cron run fails, the next run resumes from the last saved cursor without losing data.
- **Cons**:
  - 1-minute latency for checkout updates (can be mitigated in the UI by offering a manual "Check Payment" trigger that invokes the same polling action for that specific wallet).
