# Definition of Done (DoD)

To ensure codebase health, security, and compliance with public-facing hackathon requirements, every task and commit must strictly adhere to this Definition of Done.

## Checklist

### 1. Hackathon Public Safety (Zero-Secrets Policy)
- **No Hardcoded Credentials**: No private keys, database passwords, Stellar seed keys (`S...`), Vercel secrets, or API keys may be present in source code, comments, configuration templates, or documentation.
- **No Private Data**: Do not include real personal names, real phone numbers, real emails, or internal business secrets in any documentation, test fixtures, or database seeding scripts. Use mocks and variables.
- **Gitignore Enforcement**: All local config files (e.g. `.env`, `.env.local`, DB state files) must remain gitignored.
- **Security scan**: Running `npm run verify-done` must pass without any secret leaks flagged.

### 2. Double-Entry Ledger Balancing
- Every financial ledger event or database insert affecting accounts must strictly follow double-entry bookkeeping:
  $$\sum \text{Debit} == \sum \text{Credit}$$
- No unbalanced transactions are allowed to exist at any point.

### 3. No Custodial Escrow
- No customer funds or security deposits are to be held directly by the Vytrosti application treasury.
- All deposits and funds-in-transit must route through Trustless Work smart contracts.

### 4. Copywriting Jargon Restrictions (PRD Copy Rules)
- The codebase must not expose direct crypto/blockchain jargon to the client or in system console logs. Use the specified translations:
  - Avoid `Wallet` $\rightarrow$ Use `Account` or `Coordinates`
  - Avoid `Hash` $\rightarrow$ Use `Reference` or `ID`
  - Avoid `Blockchain` $\rightarrow$ Use `Protocol`
  - Avoid `Transaction` $\rightarrow$ Use `Transfer` or `Payment`
  - Avoid `Polling` $\rightarrow$ Use `Scanning Ledger`

### 5. HeroUI & Presentation Standards
- Direct usage of HeroUI components is required.
- Do **not** create custom wrappers around HeroUI components unless approved via ADR.
- Color styling must implement the "Vitrosti Precision Narrative" light-mode design system.

### 6. Architectural Separation
- Do not mix domain logic with infrastructure or database adapters.
- Keep structures strictly divided within `src/` (Domain, Application, Infrastructure, Presentation).

### 7. Automated Checks & Quality
- The code must compile cleanly: `npm run build` or `tsc --noEmit` runs with zero compilation errors.
- The linter must pass cleanly: `npm run lint` runs with zero errors or warnings.
- The verification suite must pass: `npm run verify-done` runs with zero violations.
