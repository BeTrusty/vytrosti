# Session 0035: Extend Dev/Test Callouts

## Objective
Apply the shared `precision-callout` visual language across additional developer and demo-facing surfaces so sandbox controls, playground entry points, and quick-fill test credentials feel like part of one system instead of isolated one-off cards.

## Decisions
- Restyled the reservation sandbox/testing panel with `precision-callout--amber` and simplified the control copy.
- Restyled the `/testnet` playground header with `precision-callout--emerald` to match the shared dev-tool visual family.
- Restyled the login quick-fill credential block as a compact demo access callout using the same shared structure.
- Kept the shared system CSS-driven instead of introducing a wrapper component, preserving direct HeroUI usage.

## Files Changed
- `src/presentation/components/ReservationDetails.tsx`
- `src/app/testnet/page.tsx`
- `src/app/login/page.tsx`
- `docs/memory/index.md`

## Next Steps
- Reuse the same callout family for any future admin/testing utilities before introducing new special-case cards.
