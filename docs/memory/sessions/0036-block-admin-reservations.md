# Session 0036: Block Admin Reservations

## Objective
Prevent admin accounts from requesting reservations from listing pages, disable the reservation controls in the UI, and surface a clear explanatory message.

## Decisions
- Added a client-side admin guard in `BookingForm` so admin sessions see a warning message instead of an enabled reservation action.
- Disabled the date inputs and primary reservation button for admin sessions to avoid presenting an actionable guest flow to backoffice users.
- Added a server-side guard in `createBooking` so admin sessions are rejected even if they try to bypass the UI.
- Documented the restriction in the guest reservations guide so QA and future contributors know the expected behavior.

## Files Changed
- `src/presentation/components/BookingForm.tsx`
- `src/application/actions/booking.ts`
- `docs/guides/guest-reservations.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0036-block-admin-reservations.md`

## Verification
- Passed: `pnpm exec eslint src/presentation/components/BookingForm.tsx src/application/actions/booking.ts`
- Passed: `pnpm run verify-done`

## Next Steps
- If admins later need to simulate guest reservations for demos, add an explicit impersonation or guest-preview flow instead of re-enabling reservation creation on admin sessions.
