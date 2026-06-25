# Session 0007: Auth Seeder Fixes, Complex Passwords, and Manual Payment Polling

- **Date**: 2026-06-25
- **Objective**: Fix Neon Auth seeding issues (upstream vs local DB sync), implement complex passwords, configure agent rule for mandatory documentation, and document manual payment status polling.

## Decisions
- **Upstream Auth Seeding**: Replaced local direct database inserts with direct HTTP POST requests to the Neon Auth proxy upstream (`/sign-up/email`) using proper `Origin` and `callbackURL` headers to register users correctly in the proxy database.
- **Complex Passwords**: Updated login page credentials and seeder accounts with robust credentials (e.g. `Vytr0sti#Admin2024!`) to prevent browser security warnings and resolve downstream auth failures.
- **Full Auth Wipe**: Configured the seeder to wipe local tables (`neon_auth.account` and `neon_auth.user`) at the start of each run to allow complete clean resets.
- **Mandatory Agent Documentation Rules**: Added Rule 8 in `AGENTS.md` enforcing that every agent session MUST generate/update documentation guides inside `docs/` and register the session in `docs/memory/index.md`.
- **Manual Payment Status Verification**: Integrated and documented a new server action (`verifyPaymentStatus`) that guests can trigger to manually poll/scan the ledger for payments rather than relying solely on cron-like jobs.

## Files Created / Modified
- `AGENTS.md` (Modified)
- `src/infrastructure/db/seeder.ts` (Modified)
- `src/app/login/page.tsx` (Modified)
- `src/application/actions/booking.ts` (Modified by user)
- `docs/testing_auth_guide.md` (Modified)
- `docs/memory/sessions/0007-auth-fixes-and-manual-polling.md` (Created)

## Next Steps
- Verify manual payment polling from guest reservation views.
