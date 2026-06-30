# Session 0037: Reservation Payment Progress Layout

## Objective
Move the payment portal to the left side of the reservation detail page, turn the right side into a step-by-step progress guide, and hide checkout-only sandbox controls until checkout actually begins.

## Decisions
- Kept the reservation summary and payment surface together in the left column so the guest sees booking data and payment coordinates in one visual group.
- Refined the left payment surface into a quieter status summary once the first transfer is confirmed, keeping room for both first-payment and deposit states in the same module.
- Added the confirmed first-payment amount to that summary so the paid value stays visible alongside the network review link.
- Matched the deposit summary card to that same visual language and added direct links to both Stellar Expert and the Trustless Work viewer when a protected contract exists.
- Replaced the old right-side payment card with a progress panel that tracks first payment, deposit protection, active stay, and checkout review.
- Restyled the progress panel to read like a fixed accordion, with only the active step expanded and the other steps collapsed as status rows.
- Moved the Trustless Work deposit action inside the expanded `Secure deposit` step so the CTA now lives within the active step instead of in a detached card below the accordion.
- Removed the duplicate standalone stay-verification card once its actions were represented inside the `Stay active` and `Checkout review` steps.
- Removed the top role-context banner from the reservation detail page to keep the screen focused on the payment and progression surfaces.
- Reworded the payment module heading and helper copy to feel more product-like and less infrastructural.
- Hid the verbose deposit protection detail block from the main page and moved it into a modal opened from the `Security Deposit` summary field.
- Replaced the unstable HeroUI modal attempt with a simple overlay portal so the deposit details truly layer over the existing page instead of replacing the background content.
- Restricted the sandbox review controls to `checking_out` so checkout-only developer tooling does not appear earlier in the journey.
- Updated the guest reservations and Trustless deposit guides to document the new layout and the checkout-only visibility rule.

## Files Changed
- `src/presentation/components/ReservationDetails.tsx`
- `docs/guides/guest-reservations.md`
- `docs/guides/trustless-deposit-flow.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0037-reservation-payment-progress-layout.md`

## Verification
- Passed: `pnpm exec eslint src/presentation/components/ReservationDetails.tsx`
- Passed: `pnpm run build` now compiles past `ReservationDetails.tsx`; the remaining failure is unrelated and comes from `src/app/login/page.tsx` using `Chip variant="flat"` where the installed HeroUI types only allow `secondary | primary | tertiary | soft`.

## Next Steps
- Validate the refreshed reservation detail screen in the browser across `pending_payment`, `paid`, `escrowed`, and `checking_out` states to fine-tune copy and spacing with real data.
