# Session 0019: Split Mock and Testnet Payment Actions

- **Date:** 2026-06-29
- **Objective:** Prevent the mock payment button from using the more complex signed-payment server action path that was still causing runtime response failures.

## What Changed

- Updated `PaymentQRPanel` so mock mode uses the lightweight `simulatePayment` server action again.
- Kept the signed server-side payment action only for non-mock testnet flows.
- Restored the wallet ID and guest public key props required by the mock simulator path.
- Preserved the existing manual verification step after simulation so the guest still confirms the payment through the ledger scan button.

## Files Changed

- `src/presentation/components/PaymentQRPanel.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `docs/memory/index.md`
- `docs/memory/sessions/0019-split-mock-and-testnet-payment-actions.md`

## Testing Notes

- Open a pending reservation in mock mode.
- Click **Execute Mock Payment**.
- Confirm the action resolves without the unexpected server response runtime error.
- Click **Verify Payment** and confirm the reservation advances after the ledger scan.

## Follow-Up

- If the signed testnet action still proves fragile, we should add dedicated server logs or isolate its state transition logic behind a smaller application service.
