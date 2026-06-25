<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Vytrosti Protocol Agent Rules

You are a Senior Staff Engineer working on Vytrosti. You MUST read, understand, and strictly follow all the project-specific rules and definitions stored in this repository before making any code modifications.

## Mandatory Rules & Guidelines

1. **Architecture & Separation**: Read [architecture.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/architecture.md). Never mix domain logic with infrastructure details (Stellar, Trustless Work, DB client).
2. **The Ponytail Decision Ladder**: Read [ponytail.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/ponytail.md). Always check for YAGNI, reuse, standard library, and native platform features before writing new code.
3. **Double-Entry Ledger Balancing**: Read [ledger.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/ledger.md). Every ledger transaction entry MUST balance debits and credits:
   $$\sum \text{Debit} == \sum \text{Credit}$$
   Unbalanced ledger entries are strictly prohibited.
4. **Wallet Pool Rotator**: Read [stellar.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/stellar.md). Do NOT use transaction memos to match bookings. Use the ephemeral pool accounts rotator states (`available` -> `assigned` -> `settling` -> `cooldown`).
5. **No Custodial Escrow**: Read [trustless.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/trustless.md). All security deposits must route through Trustless Work smart contracts.
6. **Aesthetics & UI**: Read [ui.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/ui.md). Implement the "Vitrosti Precision Narrative" light-mode design system. Do NOT create custom wrappers around HeroUI components.
7. **Definition of Done & Hackathon Safety**: Read [definition-of-done.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/definition-of-done.md). Every task and commit must satisfy the Definition of Done checklist, including public repository safety (no secrets/private keys/real data) and passing `npm run verify-done`.
8. **CRITICAL: Obligatory Session Documentation**: For every session or major feature implementation, you MUST create or update the relevant documentation guides inside the `docs/` folder (such as testing guides, architecture updates, or schemas). Clearly document how to run, configure, and test any modified or new features. **This is a blocking requirement; do not finish a task or declare success without ensuring the project documentation is fully updated.**
9. **CRITICAL: Session Memory Registration**: At the end of every agent session/task, you MUST record the session history. Create a markdown file named `docs/memory/sessions/XXXX-<description>.md` documenting the decisions, files changed, and next steps, and append it to the registry index in [docs/memory/index.md](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/memory/index.md). **This is a blocking requirement and is programmatically enforced by `npm run verify-done`. If code changes exist, verification will fail without corresponding session documentation updates.**

## Domain Model Definitions

Consult the Definition Registry under [docs/domain/definitions/](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/domain/definitions/`) for the definitive schemas and states. Do NOT modify fields, states, or contract workflows without updating the registry first.

## Copywriting Jargon Restrictions (PRD Copy Rules)

Do NOT use crypto jargon in the client-facing UI or console logs. Adhere to these mappings:

- **Wallet** $\rightarrow$ Use **Account** or **Coordinates**
- **Hash** $\rightarrow$ Use **Reference** or **ID**
- **Blockchain** $\rightarrow$ Use **Protocol**
- **Transaction** $\rightarrow$ Use **Transfer** or **Payment**
- **Polling** $\rightarrow$ Use **Scanning Ledger**
