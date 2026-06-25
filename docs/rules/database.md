# Database Rules

This document outlines Neon Postgres and Drizzle ORM conventions.

## DB Conventions
- **Snake Case in Postgres**: Table names, column names, and indices must use `snake_case`.
- **Camel Case in TypeScript**: Map database columns to `camelCase` properties in Drizzle.
- **Strict Keys**: Always enforce foreign keys and non-nullability where appropriate.
- **No Cascade Deletes on Core Data**: Never use `cascade` deletes on listings, reservations, or ledger tables. Use soft-deletes or status enums.

## Drizzle Guidelines
- Keep schemas structured inside `src/infrastructure/db/schema.ts` (or separated if growing large, but a single file is preferred for PoC simplicity).
- Use `drizzle-kit` to generate SQL migrations. Run migrations on startup or through a deploy script. Do not modify migrations manually.

## Bookkeeping & Ledger Tables
- Ledger lines must reference ledger entries.
- Accounts are identified by paths (e.g. `assets:escrow`, `liabilities:owners:123`).
- Use `numeric` columns for ledger amounts to avoid floating point issues. Do not use float/real.
