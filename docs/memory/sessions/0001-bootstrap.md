# Session 0001: Bootstrap and Documentation

- **Date**: 2026-06-25
- **Objective**: Initialize the project documentation, establishing rules, domain definitions, and ADRs before executing the Next.js code bootstrap.

## Decisions
- Established Clean Architecture guidelines inside `docs/rules/architecture.md`.
- Adopted Ponytail "ladder of decisions" framework inside `docs/rules/ponytail.md`.
- Formulated the Wallet Pool pattern (ADR 0001) to rotate ephemeral wallets and match payments without requiring memos.
- Formulated the Internal Double-Entry Ledger rules (ADR 0002) for auditability and balance safety.
- Approved Cron polling mechanism (ADR 0003) to scan Horizon in Serverless environments.
- Defined Trustless Work Escrow integration (ADR 0004) for non-custodial security deposit management.

## Files Created
- `docs/rules/ponytail.md`
- `docs/rules/architecture.md`
- `docs/rules/coding.md`
- `docs/rules/database.md`
- `docs/rules/stellar.md`
- `docs/rules/trustless.md`
- `docs/rules/ledger.md`
- `docs/rules/ui.md`
- `docs/rules/security.md`
- `docs/rules/agentic-engineering.md`
- `docs/domain/definitions/tenant.md`
- `docs/domain/definitions/owner.md`
- `docs/domain/definitions/listing.md`
- `docs/domain/definitions/reservation.md`
- `docs/domain/definitions/wallet.md`
- `docs/domain/definitions/payment-intent.md`
- `docs/domain/definitions/escrow.md`
- `docs/domain/definitions/payout.md`
- `docs/domain/definitions/dispute.md`
- `docs/domain/definitions/settlement.md`
- `docs/domain/definitions/ledger.md`
- `docs/adr/0001-wallet-pool.md`
- `docs/adr/0002-ledger.md`
- `docs/adr/0003-stellar-polling.md`
- `docs/adr/0004-trustless.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0001-bootstrap.md`

## Next Steps
- Initialize the Next.js App Router application in the workspace root.
- Install core dependencies (HeroUI, Drizzle ORM, Stellar SDK, Tailwind).
- Define Drizzle schema mapping.
