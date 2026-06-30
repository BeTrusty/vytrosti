# Session 0040: Show Escrow Outcome In Payment Status

- Date: 2026-06-29
- Objective: Reflect returned, retained, and disputed escrow outcomes directly inside the reservation `Payment Status` surface.

## What Changed

- Updated the admin dispute resolution action so dispute records now persist the correct terminal status:
  - `resolved_to_tenant`
  - `resolved_to_owner`
  - `split_resolution`
- Extended the reservation detail loader to include the latest dispute attached to the reservation escrow.
- Updated `ReservationDetails` so the `Payment Status` security deposit card now shows:
  - `Returned`
  - `Retained`
  - `Partially retained`
  - `In dispute`
  - plus the resolution summary when available in the deposit details modal.

## Files Changed

- `src/application/actions/admin.ts`
- `src/app/reservations/[id]/page.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `docs/guides/guest-reservations.md`
- `docs/guides/trustless-deposit-flow.md`

## Verification

- Run `pnpm run verify-done`

## Next Steps

- Consider persisting settlement rows for dispute resolutions too, so guest and admin surfaces can show exact returned vs retained amounts without relying only on dispute resolution metadata.
