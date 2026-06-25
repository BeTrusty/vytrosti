# ADR 0002: Internal Double-Entry Ledger

## Status
Approved

## Context
A booking platform handles various financial states: rents paid, security deposits escrowed, dispute resolutions, and payout distributions.
Using the blockchain transaction history (Stellar Horizon API) as the sole record of accounting poses problems:
1. **Network Lag / Outages**: Relying on Horizon endpoints for instant financial reports is slow and can fail during rate limits or network issues.
2. **Abstract states**: Ledger states like "deposits owed to tenant" or "rent revenue recognized" do not map directly to simple on-chain transaction logs.
3. **Auditability**: Horizon history only records transfers. It does not record the matching business contexts (e.g. why money was moved, fee splits, or platform margins).

## Decision
We will implement an internal **Double-Entry Ledger** in our database as the definitive accounting engine. 
- Ledger operations are recorded in terms of debit/credit transactions.
- Transactions are immutable.
- A database constraint or strict application assertion ensures $\sum \text{Debit} == \sum \text{Credit}$ before writing any ledger entry.
- On-chain operations are mapped to ledger transactions to maintain an auditable trail.

## Consequences
- **Pros**:
  - Fully auditable accounting trail that matches standard booking practices.
  - Guarantees financial integrity (cannot create unbalanced assets or liabilities).
  - High performance: financial queries run directly in Postgres.
- **Cons**:
  - Increased database schema complexity.
  - Requires developers to understand double-entry bookkeeping rules.
