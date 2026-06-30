# Session 0038: Fix Checkout And Claim RSC Runtime Error

## Objective
Eliminate the reservation-page runtime failure `"An unexpected response was received from the server"` that appeared when requesting checkout, claiming the deposit, or filing a stay dispute.

## Decisions
- Moved checkout request, checkout settlement, and dispute creation behind reservation-specific route handlers that return JSON instead of relying on the client-side Server Action protocol.
- Extracted the reservation workflow into `src/application/services/reservation-workflow.ts` so route handlers and legacy server actions share one authorization and state-transition implementation.
- Added backend authorization checks for guest checkout requests, host review approvals, guest post-expiry claims, and host/admin disputes.
- Tightened dispute validation so the claimed amount cannot exceed the protected deposit and disputes cannot be opened after the review window has expired.
- Hardened `src/app/reservations/[id]/page.tsx` against non-serializable or incomplete relation data during RSC revalidation by sanitizing dates, strings, and optional relations.
- Added a reservation-segment `error.tsx` boundary so an RSC refresh failure shows a retryable reservation UI instead of the generic Next.js runtime crash.

## Files Changed
- `src/application/services/reservation-workflow.ts`
- `src/app/api/reservations/[id]/checkout/route.ts`
- `src/app/api/reservations/[id]/dispute/route.ts`
- `src/app/reservations/[id]/page.tsx`
- `src/app/reservations/[id]/error.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `src/application/actions/booking.ts`
- `docs/guides/guest-reservations.md`
- `docs/guides/trustless-deposit-flow.md`
- `docs/memory/index.md`

## Verification
- Passed: `pnpm exec eslint src/presentation/components/ReservationDetails.tsx src/app/reservations/[id]/page.tsx src/app/reservations/[id]/error.tsx src/app/api/reservations/[id]/checkout/route.ts src/app/api/reservations/[id]/dispute/route.ts src/application/services/reservation-workflow.ts src/application/actions/booking.ts`
- Passed: `pnpm run verify-done`
- Blocked by pre-existing repo errors: `pnpm exec tsc --noEmit`
  - `src/app/login/page.tsx(121,33): error TS2322`
  - `src/presentation/components/BookingForm.tsx(117,17): error TS2322`
  - `src/presentation/components/BookingForm.tsx(128,17): error TS2322`
  - `src/presentation/components/PaymentQRPanel.tsx(231,17): error TS2322`
  - Confirmed: the `tsc` output did not report errors in the reservation files changed by this session.

## Next Steps
- Exercise the reservation flow in the browser for `active -> checking_out -> completed` and `checking_out -> disputed` to confirm the new JSON endpoints and authorization paths match the intended roles.
