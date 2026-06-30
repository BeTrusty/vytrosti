# Session 0013: Cheap Seeder Prices for Testing

- **Date**: 2026-06-29
- **Objectives**:
  1. Change the database seeder so that listings have cheap USDT prices (ranging from 1.0 to 10.0 USDT) for easier testing.
  2. Scale all mock reservations, payment intents, escrows, and double-entry ledger entries in the seeder to keep the bookkeeping rules balanced.
  3. Clean up the `blockchain_transactions` table during seeding to prevent foreign key constraint violations on seed re-runs.

## Decisions

### 1. Low Cost Listings
- **Price Adjustments**: Reduced `pricePerNightUsdt` and `securityDepositUsdt` values for all 20 listings in the seeder to small USDT amounts (between 1.0 and 10.0 USDT).

### 2. Double-Entry Balancing on Mock Bookings
- **Calculation Scaling**:
  - **Booking 1 (Pending Payment)**: 4 nights at Uluwatu Sanctuary -> Subtotal 4.0 USDT, platform fee 0.20 USDT (5%), security deposit 1.0 USDT. Total: 5.2 USDT.
  - **Booking 2 (Escrowed / Deposit Secured)**: 5 nights at Neo-Tokyo Loft -> Subtotal 10.0 USDT, platform fee 0.50 USDT, security deposit 2.0 USDT. Total: 12.5 USDT.
  - **Booking 3 (Completed)**: 5 nights at Alpina Peak Cabin -> Subtotal 15.0 USDT, platform fee 0.75 USDT, security deposit 3.0 USDT. Total: 18.75 USDT.
  - **Booking 4 (Disputed)**: 5 nights at Azure Cliff Estate -> Subtotal 20.0 USDT, platform fee 1.0 USDT, security deposit 4.0 USDT. Total: 25.0 USDT.
- **Ledger Entries Alignment**: Adjusted all debit/credit lines in the mock double-entry ledger inputs inside [seeder.ts](file:///Users/gpilla/Workspace/betrusty/vytrosti/src/infrastructure/db/seeder.ts) to match the new totals, satisfying $\sum \text{Debit} == \sum \text{Credit}$.

### 3. Clear Blockchain Transactions
- **Foreign Key Violation Resolution**: Imported and added `blockchainTransactions` to the table clearing step at the start of the seeder to enable clean, error-free database re-runs.

## Files Created / Modified
- `src/infrastructure/db/seeder.ts` (Modified)
- `docs/memory/sessions/0013-cheap-seeder-prices-for-testing.md` (Created)
- `docs/memory/index.md` (Modified)

## Next Steps
- Verify the payment flows with the new low pricing on the Stellar testnet.
