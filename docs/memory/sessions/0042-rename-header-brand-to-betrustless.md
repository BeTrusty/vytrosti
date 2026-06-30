# Session 0042: Rename Header Brand to BeTrustless

- **Date**: 2026-06-30
- **Objective**: Update the shared navigation header so the visible product name reads `BeTrustless`.

## Decisions

### 1. Header Copy Only
- Kept the existing shared navbar structure, logo asset, and layout intact.
- Replaced the visible navbar wordmark from `vytrosti` to `BeTrustless`.
- Updated the home link accessibility label and logo alt text to match the new header brand copy.

### 2. Branding Documentation
- Updated the branding assets guide so future brand changes know the header currently renders the `BeTrustless` wordmark alongside the shared logo asset.

## Files Created / Modified

- `src/presentation/components/Navbar.tsx`
- `docs/guides/branding-assets.md`
- `docs/memory/sessions/0042-rename-header-brand-to-betrustless.md`
- `docs/memory/index.md`

## Verification

- Planned: `pnpm exec eslint src/presentation/components/Navbar.tsx`

## Next Steps

- If the broader product rename should extend beyond the header, align metadata, login copy, and other remaining `Vytrosti` references in a dedicated follow-up.
