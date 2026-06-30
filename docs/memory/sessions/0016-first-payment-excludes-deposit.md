# Session 0016: First Payment Excludes Deposit

- **Date:** 2026-06-29
- **Objective:** Make the reservation payment portal charge only rent plus platform fee, while keeping the security deposit visible as separate escrow data.

## What Changed

- Updated the booking creation flow so the initial payment intent amount now equals `subtotal + platform fee`.
- Updated the payment poller so the first payment only sweeps rent plus fee to treasury and leaves the reservation in `paid` state instead of auto-funding escrow.
- Updated the reservation UI to show:
  - `First Payment Due` in the payment portal,
  - the security deposit amount as separate reference data,
  - and post-payment messaging that the deposit is secured in a later escrow step.
- Added a dedicated reservation summary block showing both the security deposit and the first payment commitment.

## Files Changed

- `src/application/actions/booking.ts`
- `src/application/services/poller.ts`
- `src/presentation/components/PaymentQRPanel.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `docs/domain/definitions/payment-intent.md`
- `docs/testing_auth_guide.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0016-first-payment-excludes-deposit.md`

## Testing Notes

- Create a 4-night reservation on a listing priced at `1.00 USDT/night` with a `0.20 USDT` fee and `1.00 USDT` deposit.
- Confirm the portal requests `4.20 USDT`.
- Confirm the security deposit remains visible in the summary but not included in that portal amount.
- Confirm verification moves the reservation to `paid` and does not create an escrow record yet.

## Follow-Up

- A separate escrow funding action is still needed to actually lock the security deposit after the first payment. This session intentionally stopped short of inventing that second-step workflow.
