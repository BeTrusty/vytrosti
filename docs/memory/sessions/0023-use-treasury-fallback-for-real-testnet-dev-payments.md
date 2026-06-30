# Session 0023: Use Treasury Fallback for Real Testnet Dev Payments

- **Date:** 2026-06-29
- **Objective:** Ensure the authenticated development payment flow stays on real Stellar testnet even when the guest source account is missing from Horizon.

## What Changed

- Replaced the local mock fallback in the dev execute-payment route.
- When the guest account cannot be loaded from Horizon, the route now submits a real testnet USDT payment from the configured treasury account to the reservation wallet.
- This keeps the dev shortcut on-chain instead of falling back to DB-only simulation.

## Files Changed

- `src/app/api/dev/execute-payment/route.ts`
- `docs/memory/index.md`
- `docs/memory/sessions/0023-use-treasury-fallback-for-real-testnet-dev-payments.md`

## Testing Notes

- In non-mock mode, open a pending reservation whose guest account is not active on testnet.
- Click **Execute Testnet Payment**.
- Confirm the route submits a real payment using treasury fallback instead of failing with the mock-mode simulation error.
- Click **Verify Payment** and confirm the transfer is detected in the normal scan flow.
