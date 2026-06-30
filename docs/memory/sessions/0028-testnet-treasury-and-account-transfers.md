# 0028 - Testnet Treasury And Account Transfers

Date: 2026-06-29

## Objective

Extend `/testnet` so developers can inspect treasury balances, prepare treasury trustlines, fund treasury assets, and move balances between system-configured accounts.

## Decisions

- Added treasury-specific server actions to:
  - read treasury balances and explorer URL,
  - activate treasury with Friendbot,
  - create treasury trustlines,
  - fund treasury assets.
- Added a configured-account discovery action so the UI can offer transfers between:
  - treasury,
  - developer master,
  - pool accounts,
  - hosts,
  - guests.
- Implemented a transfer action that resolves secrets from the correct source:
  - environment treasury keys,
  - environment/database master keys,
  - persisted host/guest secrets in `system_configs`,
  - encrypted pool account secrets.
- Added explicit handling for the case where treasury and USDT issuer are the same account, surfacing that the issuer cannot hold a normal balance of its own asset.

## Files Changed

- `src/application/actions/testnet.ts`
- `src/app/testnet/page.tsx`
- `docs/guides/stellar-testnet-setup.md`
- `docs/memory/index.md`
- `docs/memory/sessions/0028-testnet-treasury-and-account-transfers.md`

## Verification

- Passed: `pnpm exec tsc --noEmit`
- Passed: `pnpm exec eslint src/app/testnet/page.tsx src/application/actions/testnet.ts`
- Passed: `pnpm run verify-done`

## Next Steps

- If product wants fully self-serve setup, add a dedicated issuer/treasury bootstrap wizard so the treasury can be separated from the USDT issuer without manual env edits.
