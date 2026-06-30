# Session Memory: Configurable Checkout & Dispute Window

## Objective
Implement a role-based two-step checkout flow for security deposit protection.
1. **Guest initiates checkout & claims deposit**: Moves the reservation to a new `checking_out` state and sets a timestamp.
2. **Review Window (Configurable, default 72h)**: The Owner (Host) can either accept the checkout (releasing the deposit to the Guest) or open a dispute.
3. **Automatic Expiration (Simulation & Polling)**: If the Host does not act within the window, the deposit is automatically released. We will implement:
   - A server action to sweep and auto-settle expired checkouts.
   - An Admin-only button on the page to trigger this sweep immediately (simulating the cron job).
   - Integrate this sweep into the database poller action so it runs as part of standard background scanning.
4. **Role-Based UI Controls**: Buttons are shown only to the corresponding logged-in role (Host or Guest) with explanations, plus a debug panel to adjust the dispute window for hackathon verification.

## Decisions
- Added `checking_out` status to `reservation_status` enum in PostgreSQL and Drizzle schema.
- Added `checkout_claimed_at` (timestamp) column to `reservations` table to track when checkout was requested.
- Implemented `requestCheckout(reservationId)` server action in `src/application/actions/booking.ts`.
- Updated `executeCheckoutSettlement(reservationId)` to allow execution when status is `'checking_out'`.
- Implemented `checkAndExpireCheckouts()` in `src/application/actions/admin.ts` to automatically complete checkout settlements once the dispute window expires.
- Implemented `setDisputeWindowHoursAction(hours)` in `src/application/actions/admin.ts` to modify the window length on-chain/mock via `system_configs`.
- Integrated checkout auto-expiration sweep inside `triggerPollerAction` so it runs automatically during standard background/manual scanning.
- Designed role-based UI in `ReservationDetails.tsx` with clear explanations and a mock sandbox controls panel for hackathon evaluation (allowing 1-minute expiration testing).

## Files Changed
- `src/infrastructure/db/schema.ts`
- `src/application/actions/booking.ts`
- `src/application/actions/admin.ts`
- `src/app/reservations/[id]/page.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `docs/domain/definitions/reservation.md`
- `docs/domain/definitions/escrow.md`
- `docs/memory/index.md`

## Next Steps
- Present the working POC flow to the user and evaluate testnet / mock integrations.
