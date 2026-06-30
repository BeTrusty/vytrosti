# Session 0041: Sticky Demo Transfer Toast

- Date: 2026-06-29
- Objective: Keep the demo transfer success toast open until dismissal and include a direct transfer link when a real testnet transfer is submitted.

## What Changed

- Updated the reservation payment demo action parser to retain `txHash` values returned by both demo payment endpoints.
- Updated the `Send demo` success toast so it:
  - stays open until the user dismisses it
  - shows a direct Stellar Expert transfer link for real testnet transfers
  - falls back to an inline reference when the transfer is mock-only

## Files Changed

- `src/presentation/components/PaymentQRPanel.tsx`
- `docs/guides/guest-reservations.md`

## Verification

- Run `pnpm run verify-done`

## Next Steps

- Consider applying the same persistent linked-toast pattern to other developer transfer actions in the testnet tooling for consistency.
