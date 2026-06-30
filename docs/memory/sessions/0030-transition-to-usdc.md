# Session Memory: Transition from USDT to USDC

## Objective
Fully transition the platform's primary payment and escrow currency from USDT to USDC on the Stellar network, utilizing the requested USDC issuer public key for the Trustless Work escrow configuration.

## Key Decisions & Implementation Details
- **Renamed Environment Variables**: Replaced all references to `STELLAR_USDT_ASSET_CODE` with `STELLAR_USDC_ASSET_CODE` (default value `'USDC'`), and `STELLAR_USDT_ASSET_ISSUER` with `STELLAR_USDC_ASSET_ISSUER` (default value `'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'`).
- **Core Provider Updates**: Modified `StellarProvider` (`src/infrastructure/stellar/provider.ts`) to read the USDC environment variables and updated transaction method names from `sendUsdt`/`establishUsdtTrustline` to `sendUsdc`/`establishUsdcTrustline` while maintaining mock simulation fallbacks.
- **API and Action Updates**:
  - Updated payment execution route handler (`src/app/api/dev/execute-payment/route.ts`) to use `establishUsdcTrustline` and `sendUsdc`.
  - Updated server action helpers (`src/application/actions/booking.ts`, `src/application/actions/testnet.ts`, and `src/application/actions/admin.ts`) to sweep and process payments in USDC.
  - Adjusted `getTreasuryStatusAction` in `testnet.ts` to fetch USDC issuer details.
  - Updated poller sweep daemon (`src/application/services/poller.ts`) to sweep USDC.
- **Frontend & UI Updates**:
  - Configured `DepositEscrowPanel` (`src/presentation/components/DepositEscrowPanel.tsx`) to deploy escrows using `symbol: 'USDC'` and address `usdcIssuerPublicKey`.
  - Updated text elements, labels, cost breakdowns, and overview stats from USDT to USDC on pages like `/reservations/[id]`, `/reservations`, home page (`/`), `AdminDashboard`, `ListingsExplorer`, `BookingForm`, and `PaymentQRPanel`.

## Architectural / DB Decision
- As per project constraints, internal database schema column names ending with `_usdt` (e.g., `price_per_night_usdt`) were preserved to maintain system-wide schema integrity without introducing risky database migrations. The application logic abstracts this cleanly so the user and Stellar ledger only interact with USDC.

## Next Steps
- Verify the build and check compliance via `npm run verify-done`.
- Verify the flow on testnet or mock environment to ensure escrows deploy correctly using USDC.
