# Session 0018: Fix Mock Payment Server Response

- **Date:** 2026-06-29
- **Objective:** Fix the reservation runtime error triggered by the mock payment button and restore a coherent mock first-payment flow.

## What Changed

- Removed the database `UPDATE` side effect from the reservation page render path.
- Changed the reservation page to derive the displayed pending first-payment amount without mutating DB state during render.
- Updated the mock payment server action so, in mock mode, it now:
  - simulates the transfer,
  - marks the payment intent as `paid`,
  - marks the reservation as `paid`,
  - moves the assigned wallet to `settling`,
  - posts the balanced ledger receipt,
  - and runs the settling sweep flow.
- Revalidated reservation and admin pages after the mock action completes.

## Files Changed

- `src/application/actions/booking.ts`
- `src/app/reservations/[id]/page.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0018-fix-mock-payment-server-response.md`

## Testing Notes

- Open a pending reservation and click **Execute Mock Payment**.
- Confirm the action returns normally without the "unexpected response" runtime error.
- Confirm the reservation page still renders and the payment state advances consistently for mock mode.

## Follow-Up

- If we later add a separate escrow-funding step, the mock flow should simulate that second action explicitly instead of stopping after the first-payment sweep.
