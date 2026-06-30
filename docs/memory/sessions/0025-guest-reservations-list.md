# 0025 - Guest Reservations List

Date: 2026-06-29

## Objective

Allow a guest to review the list of reservations they currently have, so they do not lose the booking reference after creation.

## Decisions

- Added a dedicated `/reservations` page for authenticated guests.
- Scoped the page to the signed-in guest by resolving the session email to the local `users` and `tenants` records.
- Tightened `/reservations/[id]` so only the owning guest or an admin can access the detail page.
- Added project documentation for the guest reservation flow and verification steps.

## Files Changed

- `src/app/reservations/page.tsx`
- `src/app/reservations/[id]/page.tsx`
- `src/app/page.tsx`
- `docs/guides/guest-reservations.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0025-guest-reservations-list.md`

## Verification

- Passed: `pnpm exec eslint src/app/reservations/page.tsx src/app/reservations/[id]/page.tsx src/app/page.tsx`
- Passed: `pnpm run verify-done`
- Blocked outside this change: `pnpm exec tsc --noEmit`
  - Current repository error: `src/application/actions/booking.ts(384,31): Property 'txHash' does not exist on type ...`

## Next Steps

- Consider exposing a persistent "My Reservations" entry in shared navigation once the current in-flight navbar work is stabilized.
- Consider extracting the reservation status badge into a shared presentation component if more guest surfaces need it.
