# Session 0021: Move Testnet Payment to Route Handler

- **Date:** 2026-06-29
- **Objective:** Remove the remaining signed-payment server action dependency from the reservation payment panel after confirming authenticated users were still hitting the testnet execution path.

## What Changed

- Added `POST /api/dev/execute-payment` to run the signed testnet payment flow through a route handler.
- Updated `PaymentQRPanel` so non-mock mode also uses `fetch` instead of a server action call.
- Left payment verification on the existing ledger-scan action for now, since the crash was tied to the payment execution click path.

## Files Changed

- `src/app/api/dev/execute-payment/route.ts`
- `src/presentation/components/PaymentQRPanel.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0021-move-testnet-payment-to-route-handler.md`

## Testing Notes

- Open an authenticated pending reservation in non-mock mode.
- Click **Execute Testnet Payment**.
- Confirm the click no longer triggers the unexpected server response runtime failure.
- Then click **Verify Payment** to continue the existing confirmation flow.

## Follow-Up

- If verification later shows similar instability, the same route-handler approach should be applied to the verify step as well.
