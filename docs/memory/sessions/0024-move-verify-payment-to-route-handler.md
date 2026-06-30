# Session 0024: Move Verify Payment to Route Handler

- **Date:** 2026-06-29
- **Objective:** Remove the `Verify Payment` button from the server action path after it continued to trigger the unexpected server response runtime error.

## What Changed

- Added `POST /api/dev/verify-payment` to execute the payment scan and return a JSON result.
- Updated `PaymentQRPanel` so the verify button now uses `fetch` instead of the `verifyPaymentStatus` server action.
- Kept the existing payment poller logic intact; only the invocation transport changed.

## Files Changed

- `src/app/api/dev/verify-payment/route.ts`
- `src/presentation/components/PaymentQRPanel.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0024-move-verify-payment-to-route-handler.md`

## Testing Notes

- Open a reservation with a pending payment intent.
- Execute a payment.
- Click **Verify Payment**.
- Confirm the request completes without the unexpected server response runtime error and the reservation refreshes when the payment is detected.
