# Double-Entry Ledger Rules

A double-entry ledger is the source of truth for financial tracking. The blockchain tracks physical asset settlement, while the ledger tracks accounting obligations.

## Strict Balancing Rule
- Every `ledger_entry` must compose at least two `ledger_line`s.
- The balance equation must hold true:
  $$\sum \text{Debit} == \sum \text{Credit}$$
- Any code attempting to insert an unbalanced ledger entry must throw a database-level or application-level transaction error and abort.

## Immutable Trail
- **No Updates/Deletions**: Ledger entries and lines are strictly insert-only.
- **Adjustments**: Corrections must be made by inserting a new balancing entry (e.g. reversal or adjustment entry) referencing the original entry.

## Standard Chart of Accounts
Use these standard root namespaces for accounts:
- `assets:wallet_pool:<wallet_address>` - USDT temporarily held in pool wallet.
- `assets:escrow:trustless:<contract_id>` - Deposit locked in Trustless Work.
- `assets:treasury` - Platform fee holdings.
- `liabilities:owners:<owner_id>` - Owed to property owner.
- `liabilities:tenants:<tenant_id>` - Owed to tenant (e.g. refundable deposit).
- `equity:platform` - Accumulated earnings.
- `revenue:fees` - Collected platform fees.
