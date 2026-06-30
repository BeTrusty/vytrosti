# 0027 - Trustless Preflight And Explorer Links

Date: 2026-06-29

## Objective

Prevent raw Trustless Work deployer failures by validating the required Stellar accounts before escrow creation and giving the user direct explorer links to fix missing setup.

## Decisions

- Extended the Trustless Work preflight route so it validates both:
  - the host receiver account
  - the platform treasury account
- Kept the validation in infrastructure/application boundaries by reusing `stellarProvider.getAssetReadiness()` instead of adding Horizon logic in the client.
- Updated the deposit panel to:
  - block submission when either account is inactive or missing the USDT trustline
  - show a role-specific explanation
  - include a direct Stellar Expert link for each blocked account
- Passed the correct explorer base URL from the reservation page so the panel links to either public or testnet accounts without guessing in the client.

## Files Changed

- `src/app/api/trustless/preflight/route.ts`
- `src/app/reservations/[id]/page.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `src/presentation/components/DepositEscrowPanel.tsx`
- `docs/guides/trustless-deposit-flow.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0027-trustless-preflight-and-explorer-links.md`

## Verification

- Passed: `pnpm exec tsc --noEmit`
- Passed: `pnpm exec eslint src/infrastructure/stellar/provider.ts src/app/api/trustless/preflight/route.ts src/presentation/components/DepositEscrowPanel.tsx src/app/reservations/[id]/page.tsx src/presentation/components/ReservationDetails.tsx`
- Passed: `pnpm run verify-done`

## Next Steps

- If product wants a smoother onboarding, add an admin/testnet utility that prepares owner and treasury trustlines directly instead of only blocking and explaining.
