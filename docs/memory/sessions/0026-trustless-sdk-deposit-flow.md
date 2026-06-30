# 0026 - Trustless SDK Deposit Flow

Date: 2026-06-29

## Objective

Implement the post-payment security deposit step so a reservation can move from `paid` to `escrowed` using the Trustless Work React SDK.

## Decisions

- Added a dedicated client panel on the reservation detail page for the protected deposit step after the first payment is confirmed.
- Wired the app through `TrustlessWorkConfig` at the top-level provider so the Trustless Work hooks are available in reservation flows.
- Kept signing server-side for development by introducing an authenticated route that signs Trustless Work envelopes with the guest secret already stored in `system_configs`.
- Split escrow persistence into two application states:
  - `initialized`: contract metadata is stored locally after the create-envelope succeeds.
  - `funded`: reservation advances to `escrowed` only after the funding-envelope succeeds.
- Added a dedicated application service to persist escrow state and post the balanced deposit ledger entry.
- Preserved a mock path with `/api/dev/mock-escrow` so local flows can still be verified when `TRUSTLESS_MOCK=true`.
- Updated reservation domain and setup guides to reflect the new `paid -> escrowed` transition.

## Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/app/reservations/[id]/page.tsx`
- `src/app/api/trustless/sign-transaction/route.ts`
- `src/app/api/trustless/escrows/record/route.ts`
- `src/app/api/dev/mock-escrow/route.ts`
- `src/application/actions/booking.ts`
- `src/application/actions/admin.ts`
- `src/application/services/reservation-escrow.ts`
- `src/presentation/components/ReservationDetails.tsx`
- `src/presentation/components/DepositEscrowPanel.tsx`
- `docs/domain/definitions/reservation.md`
- `docs/guides/stellar-testnet-setup.md`
- `docs/guides/trustless-deposit-flow.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0026-trustless-sdk-deposit-flow.md`

## Verification

- Passed: `pnpm exec tsc --noEmit`
- Passed: `pnpm exec eslint src/app/layout.tsx src/app/providers.tsx "src/app/reservations/[id]/page.tsx" src/application/actions/booking.ts src/application/actions/admin.ts src/application/services/reservation-escrow.ts src/presentation/components/ReservationDetails.tsx src/presentation/components/DepositEscrowPanel.tsx src/app/api/trustless/sign-transaction/route.ts src/app/api/trustless/escrows/record/route.ts src/app/api/dev/mock-escrow/route.ts`
- Passed: `pnpm run verify-done`

## Next Steps

- Confirm with a real Trustless Work API key whether the existing release/dispute REST adapter accepts the stored `trustlessEscrowId` from SDK-created escrows, or migrate those later steps to SDK-backed envelopes too.
- If this flow moves beyond hackathon/dev use, replace the server-side development signature bridge with a real user-controlled Stellar signer in the browser.
- Add a richer host onboarding flow if product wants the app to auto-prepare owner accounts instead of blocking on missing trustlines.
