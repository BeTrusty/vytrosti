# Session 0014 - Fix RSC Crash E394 on Reservation Page

**Date**: 2026-06-29  
**Objective**: Fix the runtime error "An unexpected response was received from the server" (Next.js E394) that crashed the `/reservations/[id]` page when clicking "Verify Payment".

## Problem Diagnosed

The error `E394 – An unexpected response was received from the server` is produced by the Next.js client-side server-action reducer when the HTTP response from a Server Action does not have `content-type: text/x-component`.

This occurs when the RSC re-render triggered by `revalidatePath(...)` (inside `verifyPaymentStatus`) fails with an uncaught exception at the Next.js framework level. The exception was caused by two vulnerabilities in `page.tsx`:

1. **Unprotected `systemConfigs` query**: After the main reservation query, a second Drizzle query for `systemConfigs` was executed without a `try-catch`. If the DB connection timed out during the background RSC re-render, this query could throw an uncaught exception that corrupted the RSC payload.

2. **Non-optional chaining on `res.listing`**: The `res.listing.title` / `res.listing.city` / `res.listing.country` accesses used non-optional chaining. If the `listing` relation was missing or null, these would throw and crash the RSC render silently.

Additionally, `verifyPaymentStatus` in `booking.ts` contained redundant dynamic `import()` calls for `paymentIntents` and `eq` that were already imported statically at the top of the file. This was unnecessary and potentially caused issues.

## Files Changed

### [MODIFY] `src/app/reservations/[id]/page.tsx`
- Wrapped the `systemConfigs.findFirst()` query in its own `try-catch` block, so DB timeouts or errors during RSC re-render don't crash the page.
- Changed `res.listing.title/city/country` to use optional chaining (`res.listing?.title ?? ''`).

### [MODIFY] `src/application/actions/booking.ts`
- Removed redundant `await import('@/infrastructure/db/schema')` and `await import('drizzle-orm')` calls inside `verifyPaymentStatus`.
- Changed return type of `status` from `string | undefined` to `string | null` and ensured all code paths return an explicit value, eliminating potential `undefined` serialization issues.

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run verify-done` → Verification PASSED (0 errors, 0 warnings)
