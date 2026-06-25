# ADR 0004: Trustless Work Integration for Escrow

## Status
Approved

## Context
Temporary rentals require security deposits to protect owners against property damage.
Holding deposits in platform-owned wallets creates regulatory risk (holding client funds), decreases tenant trust, and makes the platform a target for hacks.

## Decision
We will use **Trustless Work**'s escrow contracts.
- Trustless Work provides a decentralized escrow contract model on Stellar.
- Rental deposits are locked into a smart contract/account where the platform, tenant, and owner negotiate releases.
- The platform acts as the arbiter.
- Funds are only released back to the tenant (on checkout) or to the owner (if claim is approved) or split (upon resolution).

## Consequences
- **Pros**:
  - The platform never holds custody of security deposits, reducing regulatory and security liabilities.
  - Builds trust: tenants know deposits are held in a transparent smart contract, not in a private platform wallet.
- **Cons**:
  - Requires integration with the Trustless Work API.
  - Testnet configuration and mockup tools must be built to verify flows.
