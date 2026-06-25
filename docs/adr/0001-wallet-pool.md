# ADR 0001: Wallet Pool for Anonymous Payments

## Status
Approved

## Context
In decentralized booking systems, matching incoming user payments to specific reservation records is a challenge. The traditional approach uses a single merchant wallet and requires users to attach a unique identifier in the transaction `memo` field. 

However, this has significant downsides:
1. **User Error**: Users frequently forget to attach memos, or type them incorrectly, leading to lost payments and manual reconciliation.
2. **Privacy**: Exposing a single merchant wallet reveals all rental transactions, reservation volume, and platform holdings.
3. **Memo Limitations**: Stellar memos have constraints (e.g. 28-byte text limit, or 64-bit integer limit), which limits flexibility.

## Decision
We will use a **Wallet Pool** pattern. The platform maintains a pool of pre-funded Stellar wallets. 
- When a user starts checkout, the platform rents/leases a free (`available`) wallet from the pool and assigns it to that specific checkout (`assigned`).
- The user is instructed to send USDT to the public key of the leased wallet.
- The platform polls this wallet for incoming transactions. Any payment arriving at this wallet is immediately matched to the reservation without relying on memos.
- Once the payment is captured, the wallet is cleared (moved to `settling` -> `cooldown` -> `available`).

## Consequences
- **Pros**:
  - Eliminates user errors regarding memos.
  - Improves transaction privacy; payment addresses are rotated.
  - Simpler matching logic (receipt on wallet address $X$ directly confirms booking $Y$).
- **Cons**:
  - The platform must pre-fund and manage a pool of wallets (requires minor native XLM reserves for trustlines and transactions).
  - Secret key management requires secure encryption.
  - Requires a cooldown period to handle late or duplicate on-chain transactions.
