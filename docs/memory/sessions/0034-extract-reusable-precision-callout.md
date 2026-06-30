# Session 0034: Extract Reusable Precision Callout

## Objective
Replace the one-off demo transfer card styling in the reservation payment portal with a reusable highlighted surface pattern that can be applied across the product without copying hardcoded utility strings.

## Decisions
- Added a shared `precision-callout` style family in `src/app/globals.css`.
- Defined reusable slots for rail, body, eyebrow, title, copy, chip, meta rows, icon, and CTA.
- Added tone variants (`default`, `emerald`, `amber`) so future callouts can share structure while changing emphasis.
- Updated `PaymentQRPanel` to consume the shared callout classes instead of embedding one-off gradient, spacing, and button styles directly in JSX.
- Kept HeroUI usage direct by styling the existing `Button` and `Chip` with shared classes rather than creating wrapper components.

## Files Changed
- `src/app/globals.css`
- `src/presentation/components/PaymentQRPanel.tsx`
- `docs/guides/stellar-testnet-setup.md`
- `docs/rules/ui.md`
- `docs/memory/index.md`

## Next Steps
- Reuse `precision-callout` on other highlighted states such as escrow warnings, admin notices, or guided review blocks before introducing new one-off card treatments.
