# Coding Rules

This document outlines the coding standards, TypeScript conventions, and Next.js guidelines.

## General TypeScript Rules
- **Strict Typing**: No `any`. Use custom type interfaces or utility types.
- **Explicit Returns**: Always declare return types for exported functions, especially actions and route handlers.
- **Immutable State**: Treat domain entities as immutable. Return new instances or structures instead of mutating parameters.

## Next.js App Router & React Rules
- **Server Components by Default**: All components are React Server Components (RSC) by default.
- **Explicit `'use client'`**: Only add `'use client'` when interactive behavior is strictly needed (event handlers, state, hooks, HeroUI interactive elements).
- **Server Actions**: Use Server Actions for mutations (e.g. reserving a property, triggering payouts) instead of writing custom API routes unless it's a webhook/cron.
- **Route Handlers**: Use Route Handlers (`route.ts`) only for system integrations, API callbacks, and Cron trigger endpoints.

## File Organization
Structure code strictly by architectural layers within `src`:
```
src/
├── domain/            # Pure domain models, value objects, ledger assertions
├── application/       # Use cases, Cron jobs, actions
├── infrastructure/    # DB schema, DB client, Stellar/Trustless adapters
└── presentation/      # App router pages, layout, shared HeroUI components
```
Do not scatter components and utilities across arbitrary directories.
