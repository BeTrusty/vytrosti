# Vytrosti Project Memory

This index tracks all agent sessions and the historical log of Vytrosti's design and code changes.

## Session History

* [0001-bootstrap.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0001-bootstrap.md) (2026-06-25)
  - Objective: Setup project rules, domain definitions, architectural ADRs, and prepare for Next.js application bootstrap.
* [0002-bootstrap-mvp.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0002-bootstrap-mvp.md) (2026-06-25)
  - Objective: Establish Next.js App Router and define Drizzle PostgreSQL schema mapping.
* [0003-stitch-ui.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0003-stitch-ui.md) (2026-06-25)
  - Objective: Align layout styling with Stitch design proposal and implement initial mock seeder.
* [0004-verify-done-script.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0004-verify-done-script.md) (2026-06-25)
  - Objective: Refactor verification script verify-done.js to run only on git-tracked files.
* [0005-middleware-proxy.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0005-middleware-proxy.md) (2026-06-25)
  - Objective: Rename deprecated Next.js middleware and migrate to the proxy pattern.
* [0006-neon-auth.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0006-neon-auth.md) (2026-06-25)
  - Objective: Integrate Neon Auth security layer and protect Admin dashboard.
* [0007-stellar-payment-flow.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0007-stellar-payment-flow.md) (2026-06-25)
  - Objective: Upgrade Stellar SDK package, implement QR payment flow, and add toast notifications.
* [0007-auth-fixes-and-manual-polling.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0007-auth-fixes-and-manual-polling.md) (2026-06-25)
  - Objective: Fix Neon Auth seeding issues, implement complex passwords, configure mandatory documentation rules, and support manual payment verification.
* [0008-user-owner-tenant-admin.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0008-user-owner-tenant-admin.md) (2026-06-25)
  - Objective: Fix Neon database migration connections, seed 20 properties with images, build user-host-guest admin panel, and enforce session memory checks.
* [0009-vercel-turbopack-build-and-pnpm-migration.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0009-vercel-turbopack-build-and-pnpm-migration.md) (2026-06-25)
  - Objective: Resolve Turbopack build errors in client.ts due to @next/env imports, implement loadenv config utility, and transition tooling/docs to pnpm.
* [0010-testnet-developer-setup.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0010-testnet-developer-setup.md) (2026-06-29)
  - Objective: Create testnet setup page for key generation, deterministic account derivation, DB registration, programmatic USDC funding, and explorer viewer linking.
* [0011-fix-table-row-headers-and-persist-keys.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0011-fix-table-row-headers-and-persist-keys.md) (2026-06-29)
  - Objective: Fix table accessibility by adding `isRowHeader` props, and persist generated Stellar dev master keys in PostgreSQL database.
* [0012-mock-payment-and-qr-updates.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0012-mock-payment-and-qr-updates.md) (2026-06-29)
  - Objective: Remove Stellar coordinates inputs from booking request form, resolve them from the session, and implement server-signed mock payments on Stellar testnet requiring explicit manual ledger scanning.
* [0013-cheap-seeder-prices-for-testing.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0013-cheap-seeder-prices-for-testing.md) (2026-06-29)
  - Objective: Scale down listings and reservation pricing in the database seeder to cheap USDT levels for testing, keeping all double-entry accounting balances correct.
* [0014-fix-rsc-e394-reservation-crash.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0014-fix-rsc-e394-reservation-crash.md) (2026-06-29)
  - Objective: Fix Next.js E394 RSC crash on `/reservations/[id]` caused by an unprotected DB query in the RSC re-render path after `revalidatePath`, and remove redundant dynamic imports from `verifyPaymentStatus`.
* [0015-booking-summary-separates-deposit.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0015-booking-summary-separates-deposit.md) (2026-06-29)
  - Objective: Show the security deposit as separate reference data in the booking form and exclude it from the displayed first payment amount.
* [0016-first-payment-excludes-deposit.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0016-first-payment-excludes-deposit.md) (2026-06-29)
  - Objective: Change the reservation payment portal to charge only rent plus platform fee, while leaving the security deposit visible as a separate escrow follow-up amount.
* [0017-normalize-legacy-pending-payment-intents.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0017-normalize-legacy-pending-payment-intents.md) (2026-06-29)
  - Objective: Normalize old unpaid reservation payment intents so the portal no longer displays stale amounts that include the deposit.
* [0018-fix-mock-payment-server-response.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0018-fix-mock-payment-server-response.md) (2026-06-29)
  - Objective: Remove render-time DB mutations from the reservation page and make the mock payment action advance state without triggering the server response runtime error.
* [0019-split-mock-and-testnet-payment-actions.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0019-split-mock-and-testnet-payment-actions.md) (2026-06-29)
  - Objective: Route mock payments back through the lightweight simulator action and reserve the signed payment action for non-mock testnet flows.
* [0020-move-mock-payment-to-route-handler.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0020-move-mock-payment-to-route-handler.md) (2026-06-29)
  - Objective: Move mock payment execution from server actions to a route handler to avoid the repeated unexpected server response runtime failure.
* [0021-move-testnet-payment-to-route-handler.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0021-move-testnet-payment-to-route-handler.md) (2026-06-29)
  - Objective: Move non-mock signed payment execution from server actions to a route handler after confirming authenticated users were still hitting the testnet path.
* [0022-fallback-dev-payment-when-testnet-account-missing.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0022-fallback-dev-payment-when-testnet-account-missing.md) (2026-06-29)
  - Objective: Fall back to a simulated transfer in the dev execute-payment route when the guest testnet account is missing from Horizon.
* [0023-use-treasury-fallback-for-real-testnet-dev-payments.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0023-use-treasury-fallback-for-real-testnet-dev-payments.md) (2026-06-29)
  - Objective: Replace the local simulation fallback with a treasury-signed real testnet payment when the guest account is missing from Horizon.
* [0024-move-verify-payment-to-route-handler.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0024-move-verify-payment-to-route-handler.md) (2026-06-29)
  - Objective: Move payment verification from server actions to a route handler to avoid the repeated unexpected server response runtime failure on the reservation page.
* [0025-guest-reservations-list.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0025-guest-reservations-list.md) (2026-06-29)
  - Objective: Add a guest-scoped reservations list and protect reservation detail pages so guests can keep their booking references visible without exposing other users' stays.
* [0026-trustless-sdk-deposit-flow.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0026-trustless-sdk-deposit-flow.md) (2026-06-29)
  - Objective: Implement the Trustless Work SDK-backed deposit funding step so paid reservations can advance to escrowed with recorded ledger protection.
* [0027-trustless-preflight-and-explorer-links.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0027-trustless-preflight-and-explorer-links.md) (2026-06-29)
  - Objective: Validate host and platform asset readiness before Trustless Work deploys and surface direct explorer links for blocked accounts.
* [0028-testnet-treasury-and-account-transfers.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0028-testnet-treasury-and-account-transfers.md) (2026-06-29)
  - Objective: Add treasury controls and cross-account transfer tooling to the `/testnet` developer page.
* [0029-separate-usdt-issuer-for-testnet.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0029-separate-usdt-issuer-for-testnet.md) (2026-06-29)
  - Objective: Reconfigure testnet USDT to use a dedicated issuer account and align the `/testnet` tooling and docs with that separated issuer/treasury setup.
* [0030-transition-to-usdc.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0030-transition-to-usdc.md) (2026-06-29)
  - Objective: Transition the system from USDT to USDC as the primary payment and escrow token, utilizing the USDC issuer for Trustless Work escrow configuration.
* [0031-refactor-trustless-escrow-endpoints.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0031-refactor-trustless-escrow-endpoints.md) (2026-06-30)
  - Objective: Refactor Trustless Work escrow integration to use the correct API v2 endpoints and headers, implement on-chain backend signing, and balance the dispute resolution double-entry ledger postings.
* [0032-generate-new-favicon.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0032-generate-new-favicon.md) (2026-06-30)
  - Objective: Generate a new custom favicon with a sprout icon matching the "Vytrosti" brand and the light-mode design system, replacing the default Next.js favicon.
* [0033-configurable-checkout-dispute-window.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0033-configurable-checkout-dispute-window.md) (2026-06-30)
  - Objective: Implement guest-initiated checkout, owner-only dispute/accept actions, a configurable 72h review window, auto-expiration, and a hackathon debug testing panel.
* [0034-extract-reusable-precision-callout.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0034-extract-reusable-precision-callout.md) (2026-06-30)
  - Objective: Replace a one-off demo transfer card with a reusable highlighted surface pattern for shared callout styling.
* [0035-extend-dev-test-callouts.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0035-extend-dev-test-callouts.md) (2026-06-30)
  - Objective: Extend the shared callout language across developer/testing surfaces such as sandbox controls, demo access, and the testnet playground.
* [0036-block-admin-reservations.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0036-block-admin-reservations.md) (2026-06-29)
  - Objective: Prevent admin accounts from requesting reservations, disable the listing-page controls for admins, and document the restriction.
* [0037-reservation-payment-progress-layout.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0037-reservation-payment-progress-layout.md) (2026-06-29)
  - Objective: Move the reservation payment surface to the left, show journey progress on the right, and hide checkout-only sandbox controls until checkout starts.
* [0038-fix-checkout-claim-rsc-runtime-error.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0038-fix-checkout-claim-rsc-runtime-error.md) (2026-06-29)
  - Objective: Replace reservation checkout/dispute server-action mutations with JSON route handlers, harden reservation RSC serialization, and stop the checkout/claim runtime error on `/reservations/[id]`.
* [0039-refresh-logo-favicon-and-footer-links.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0039-refresh-logo-favicon-and-footer-links.md) (2026-06-29)
  - Objective: Replace the shell logo and favicon with the provided brand mark, and update the global footer credits with Trustless and BeTrusty links.
* [0040-show-escrow-outcome-in-payment-status.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0040-show-escrow-outcome-in-payment-status.md) (2026-06-29)
  - Objective: Reflect returned, retained, partially retained, and disputed escrow outcomes directly inside the reservation payment status surface.
* [0041-sticky-demo-transfer-toast.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0041-sticky-demo-transfer-toast.md) (2026-06-29)
  - Objective: Keep the demo transfer success toast open until dismissal and include a direct transfer link for real testnet submissions.
* [0041-add-reservation-money-route-card.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0041-add-reservation-money-route-card.md) (2026-06-29)
  - Objective: Add a developer-style timeline card to the reservation detail page so the full money route is visible between guest, intake account, Vytrosti, protected custody, and owner.
* [0042-rename-header-brand-to-betrustless.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/sessions/0042-rename-header-brand-to-betrustless.md) (2026-06-30)
  - Objective: Update the shared navigation header so the visible product name reads `BeTrustless`.
