# Session 0015: Booking Summary Separates Deposit

- **Date:** 2026-06-29
- **Objective:** Adjust the reservation request summary so the security deposit is shown as reference data and excluded from the "first payment" amount displayed during booking.

## What Changed

- Updated [BookingForm.tsx](file:///Users/gpilla/Workspace/betrusty/vytrosti/src/presentation/components/BookingForm.tsx) so the pricing breakdown now computes:
  - `firstPayment = rent subtotal + platform fee`
  - `totalCommitment = firstPayment + security deposit`
- Replaced the old combined total row with a clearer "First Payment" row.
- Added helper copy explaining that the security deposit is shown for reference and is not included in the first payment display because it is secured separately in escrow.
- Kept the combined commitment visible as a secondary reference so guests can still understand the full reservation exposure.

## Files Changed

- `src/presentation/components/BookingForm.tsx`
- `docs/testing_auth_guide.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0015-booking-summary-separates-deposit.md`

## Testing Notes

- Recommended manual check:
  1. Open any listing detail page.
  2. Select valid check-in and check-out dates.
  3. Confirm the security deposit appears as its own line item.
  4. Confirm the "First Payment" amount excludes the deposit.
  5. Confirm "Total Commitment" still reflects rent + fee + deposit.

## Follow-Up

- The payment intent backend still expects the full amount currently used by the existing escrow funding flow. If product decides that the actual transfer amount must also exclude the deposit, the payment and settlement orchestration will need a deeper backend redesign.
