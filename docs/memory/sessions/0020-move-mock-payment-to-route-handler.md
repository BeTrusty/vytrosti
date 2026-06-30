# Session 0020: Move Mock Payment to Route Handler

- **Date:** 2026-06-29
- **Objective:** Eliminate the remaining mock payment runtime response failure by moving the mock action off server actions and onto a standard App Router route handler.

## What Changed

- Added a dedicated `POST /api/dev/mock-payment` route handler for mock transfer simulation.
- Updated the client-side payment panel to call that route via `fetch` in mock mode.
- Kept the signed server action path only for non-mock testnet execution.

## Files Changed

- `src/app/api/dev/mock-payment/route.ts`
- `src/presentation/components/PaymentQRPanel.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0020-move-mock-payment-to-route-handler.md`

## Testing Notes

- Open a pending reservation while `STELLAR_MOCK` is active.
- Click **Execute Mock Payment**.
- Confirm the request completes without the server action runtime response error.
- Click **Verify Payment** and confirm the payment is detected through the normal ledger scan path.

## Follow-Up

- If we want auditability for simulator usage, this route can later record explicit dev-mode events or require an authenticated admin/guest session check.
