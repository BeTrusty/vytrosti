# Session 0041: Add Reservation Money Route Card

- Date: 2026-06-29
- Objective: Add a developer-style timeline card to the reservation detail page so the full money route is visible between guest, intake account, Vytrosti, protected custody, and owner.

## What Changed

- Added a new presentation component, `FundsMovementCard`, dedicated to the reservation money route.
- Modeled the UI as a chronological trace with five explicit movements:
  - `Guest account -> Reservation intake account`
  - `Reservation intake account -> Vytrosti treasury`
  - `Guest account -> Protected deposit account`
  - `Vytrosti treasury -> Host account`
  - `Protected deposit account -> Guest / Host`
- Kept the copy aligned with the PRD jargon rules by using `account`, `reference`, and `payment` language instead of raw crypto terminology in the new surface.
- Added a console-like visual treatment in `globals.css` so the card reads like a financial trace tool while still matching the existing light-mode reservation UI.
- Inserted the new card into the reservation detail flow directly under `Payment Status`, keeping the trace close to the payment and deposit summary it explains.
- Simplified the trace by removing the separate actor strip and moving that context into each `from/to` block, which now shows both the role and the related name/entity directly on the movement row.
- Switched the pending-payment demo transfer callout from the default violet accent to the amber tooling/test accent so it stays visually aligned with the rest of the sandbox language.
- Rebalanced the reservation detail grid from `8/4` to `7/5` on large screens so the `Reservation Progress` column has more room for the embedded first-payment tools.
- Added a subtle `from -> to` route line inside the demo transfer callout, with direct explorer links for both origin and destination accounts when those references are available.
- Updated the guest reservations and Trustless deposit guides so the new card is documented along with its expected state changes.

## Files Changed

- `src/presentation/components/FundsMovementCard.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `src/app/globals.css`
- `src/app/reservations/[id]/page.tsx`
- `docs/guides/guest-reservations.md`
- `docs/guides/trustless-deposit-flow.md`

## Verification

- Run `npm run lint -- src/presentation/components/FundsMovementCard.tsx src/presentation/components/ReservationDetails.tsx`
- Run `npm run verify-done`

## Next Steps

- Validate the `Money route` card in the browser with seeded reservations across `pending_payment`, `paid`, `escrowed`, `checking_out`, `completed`, and `disputed` to fine-tune labels and spacing with real states.
