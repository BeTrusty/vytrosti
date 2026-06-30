# Guest Reservations Guide

This guide documents the guest-facing reservations list introduced in session `0025`.

## Routes

- `/reservations`
  - Requires authentication.
  - Shows only reservations that belong to the signed-in guest.
  - Displays booking reference, stay dates, first payment amount, deposit amount, and current status.
- `/reservations/[id]`
  - Requires authentication.
  - Allows access only to the reservation owner, unless the signed-in user is an admin.

## Guest Flow

1. Sign in as a guest user.
2. Open `/reservations` to review all existing stays tied to that guest profile.
3. Open any reservation card to continue payment, verify payment progress, or inspect deposit protection details.

## Reservation Detail Layout

- The main payment surface lives in the left column so the payment coordinates and confirmation stay visually tied to the reservation summary.
- While the first payment is still pending, the left `Payment Status` card stays in summary mode only.
- The actionable first-payment tools for that state now live inside the expanded `Confirm first payment` step in `Reservation Progress`, including:
  - amount due
  - QR code
  - intake account coordinates
  - verify payment action
  - demo transfer action
- When the user presses `Send demo` for a real testnet transfer, the success toast should stay visible until dismissed and include a direct link to the transfer on Stellar Expert.
- After the first transfer is confirmed, the left payment surface becomes a compact status summary that keeps both the first payment and the security deposit visible in the same place.
- That same `Payment Status` summary must expose the real deposit outcome:
  - `Returned` when the protected deposit is released back to the guest.
  - `Retained` when a resolved dispute awards the deposit to the host.
  - `Partially retained` when a resolved dispute splits the deposit.
  - `In dispute` while the protected deposit remains locked for review.
- Below the payment summary, the `Money route` card maps the full funds path in chronological order with a developer-tool aesthetic:
  - `Guest account -> Reservation intake account` for the first payment.
  - `Reservation intake account -> Vytrosti treasury` once the first payment is captured.
  - `Guest account -> Protected deposit account` for the Trustless Work funding step.
  - `Vytrosti treasury -> Host account` when the stay settles.
  - `Protected deposit account -> Guest / Host` depending on checkout outcome or dispute resolution.
- Each `from/to` block inside `Money route` must show both the role and the related name/entity for that step, so guest and owner names stay visible without requiring a separate actor strip above the timeline.
- The right column is a progress guide that highlights the current phase of the journey: first payment, deposit protection, active stay, and checkout review.
- The current step in that progress guide expands like a fixed accordion and contains its own action surface, so the next CTA appears inside the step that is currently in progress.
- Standalone verification cards should not duplicate actions that already live inside the active progress step.
- Sandbox review controls stay hidden until the reservation reaches `checking_out`, so guests do not see checkout-only tooling during payment or active-stay phases.
- Checkout request, host approval, guest claim, and dispute submission now post to `/api/reservations/[id]/...` route handlers and only refresh the page after the JSON response returns, which avoids the Next.js `E394` server-action payload failure seen during reservation revalidation.
- The reservation segment also ships its own `error.tsx` boundary so a failed refresh produces a retry surface instead of the generic framework runtime message.

## Admin Restriction

- Admin accounts can review reservation records from the backoffice, but they cannot request new reservations from listing pages.
- On `/listings/[id]`, the reservation form keeps the date inputs and primary action disabled for admins and shows an explanatory message instead.
- The `createBooking` server action also rejects admin sessions so the restriction still holds if someone bypasses the UI.

## Notes For Developers

- Reservation ownership is resolved from `users.email -> tenants.userId -> reservations.tenantId`.
- The list page is request-time rendered with `revalidate = 0` so newly created reservations show immediately.
- Detail access was tightened to avoid exposing another guest's reservation page to any authenticated user.

## Manual Verification

1. Sign in with a seeded guest account.
2. Create a reservation from a listing page.
3. Confirm the new reservation appears on `/reservations`.
4. Confirm another non-admin account cannot open that reservation's detail URL directly.
5. Sign in with the seeded admin account, open any listing page, and confirm the reservation action remains disabled with the admin-only warning message visible.
6. Move a reservation through `pending_payment`, `paid`, and `checking_out`, and confirm the right-side progress panel advances while sandbox controls only appear during checkout review.
7. From `checking_out`, confirm host approval before window expiry and guest claim after expiry both complete without the "An unexpected response was received from the server" runtime error.
8. Open a reservation whose escrow is `released`, `disputed`, or `resolved` and confirm the left-side `Payment Status` card reflects `Returned`, `In dispute`, `Retained`, or `Partially retained` instead of showing a generic protected state.
9. Confirm the `Money route` card updates its step chips and destination labels as the reservation moves through `pending_payment`, `paid`, `escrowed`, `checking_out`, `completed`, and `disputed`.
10. Trigger `Send demo` on a non-mock reservation and confirm the success toast remains open until dismissed and exposes a clickable transfer link.
