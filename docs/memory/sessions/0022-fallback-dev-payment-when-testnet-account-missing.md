# Session 0022: Fallback Dev Payment When Testnet Account Missing

- **Date:** 2026-06-29
- **Objective:** Keep the authenticated development payment flow usable when the guest testnet account is missing or unfunded in Horizon.

## What Changed

- Updated the dev execute-payment route so a Horizon `404 not_found` while loading the guest source account no longer aborts the whole flow.
- When that specific testnet-account-missing condition happens, the route now falls back to a simulated local transfer using the existing mock deposit helper.
- Preserved the real signed-payment path for accounts that do exist in testnet.

## Files Changed

- `src/app/api/dev/execute-payment/route.ts`
- `docs/memory/index.md`
- `docs/memory/sessions/0022-fallback-dev-payment-when-testnet-account-missing.md`

## Testing Notes

- Open an authenticated pending reservation in the current dev environment.
- Click **Execute Testnet Payment**.
- If the guest source account is missing in Horizon, confirm the route falls back to a simulated transfer instead of returning a 500 error.
- Click **Verify Payment** and confirm the reservation continues through the normal ledger scan flow.
