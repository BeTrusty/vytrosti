# Session 0017: Normalize Legacy Pending Payment Intents

- **Date:** 2026-06-29
- **Objective:** Ensure existing unpaid reservations created before the first-payment split no longer show stale payment intent amounts that still include the deposit.

## What Changed

- Updated the reservation page loader to detect pending reservations whose active payment intent still contains the old combined amount.
- When such a mismatch is found, the page now normalizes the pending payment intent amount to `subtotal + platform fee`.
- The normalized amount is applied immediately to the rendered reservation details so the payment portal no longer asks guests to transfer the deposit in the first payment.

## Files Changed

- `src/app/reservations/[id]/page.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0017-normalize-legacy-pending-payment-intents.md`

## Testing Notes

- Open a reservation created before the pricing split that still showed `5.20 USDT`.
- Confirm the page now updates the visible first payment to `4.20 USDT`.
- Confirm the separate security deposit amount remains visible in the reservation summary.

## Follow-Up

- If we later add multiple payment intents per reservation, this normalization should move into a dedicated application-layer reconciliation helper instead of assuming the first pending intent is the active one.
