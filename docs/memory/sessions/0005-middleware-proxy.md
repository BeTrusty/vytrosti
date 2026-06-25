# Session 0005: Migrating Middleware to Proxy

- **Date**: 2026-06-25
- **Objective**: Replace the deprecated Next.js middleware file convention with the new proxy pattern routing convention.

## Decisions
- Renamed the deprecated `middleware.ts` to `src/proxy.ts`.
- Configured routes to correctly forward authenticated paths and API requests.

## Files Created / Modified
- `src/proxy.ts`
- `next.config.ts`

## Next Steps
- Implement user authentication using Neon Auth and lock host/backoffice views.
