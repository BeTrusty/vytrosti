# Definition: Ledger and Bookkeeping

The internal double-entry ledger is the financial source of truth for Vytrosti, ensuring that all movements of funds are accounted for, balanced, and fully auditable.

## Entities

### 1. Ledger Account
- `id` (String): The full account path (e.g. `assets:wallet_pool:GD32...`, `revenue:fees`, `liabilities:owners:owner1`).
- `name` (String): Human-friendly name.
- `type` (Enum): `asset`, `liability`, `equity`, `revenue`, `expense`.

### 2. Ledger Entry
- `id` (UUID): Unique internal identifier.
- `description` (String): Reason for the entry (e.g. "Booking #123 Payment Received").
- `reference_type` / `reference_id` (String): Optional reference to booking, payout, or escrow.
- `posted_at` (Timestamp): Date the entry was recorded.

### 3. Ledger Line
- `id` (UUID): Unique line identifier.
- `entry_id` (UUID): References parent Ledger Entry.
- `account_path` (String): References target Ledger Account.
- `amount` (Numeric): The absolute numeric amount.
- `direction` (Enum): `debit` or `credit`.

## Mathematical Validation
For every entry:
$$\sum \text{Debit Lines} == \sum \text{Credit Lines}$$

## Example Ledger Postings

### A. Rental Payment Detected on Pool Wallet
Tenant pays 150 USDT (100 rent, 40 deposit, 10 fee) to pool wallet `GD_POOL_1`:
- **Debit** `assets:wallet_pool:GD_POOL_1` : 150.00
- **Credit** `liabilities:tenants:guest1` : 150.00 (We owe the tenant service/deposit)

### B. Funding Trustless Work Escrow & Recording Booking Fee
Rent is recognized, deposit is sent to Trustless Work Escrow:
- **Debit** `liabilities:tenants:guest1` : 150.00 (Clearing liability)
- **Credit** `assets:escrow:trustless:esc1` : 40.00 (Deposit locked in smart contract)
- **Credit** `liabilities:owners:owner1` : 100.00 (Rent owed to owner)
- **Credit** `revenue:fees` : 10.00 (Platform fee recognized)

### C. Normal Checkout / Settlement
Release escrow, pay owner and platform. Sweeping pool wallet:
- **Debit** `liabilities:owners:owner1` : 100.00 (Clearing rent liability)
- **Debit** `assets:escrow:trustless:esc1` : 40.00 (Clearing locked deposit)
- **Credit** `assets:wallet_pool:GD_POOL_1` : 100.00 (Sweeping rent to treasury)
- **Credit** `liabilities:tenants:guest1` : 40.00 (Deposit returned to tenant)
*(This represents the on-chain movement: pool wallet transfers 100 to platform/owner, and contract releases 40 back to tenant).*
