# Session 0029: Separate USDT Issuer For Testnet

Date: 2026-06-29

## Objective

Reconfigure the Stellar testnet setup so `USDT` uses a dedicated issuer account instead of the treasury account, and align the `/testnet` tooling and documentation with that model.

## Changes Made

1. Updated the `/testnet` developer tooling to recognize the configured `STELLAR_USDT_ASSET_ISSUER` as a first-class system account.
2. Kept treasury status UI focused on the treasury account while surfacing the configured USDT issuer and explorer access beside it.
3. Clarified that testnet cannot use mainnet-native "real USDT"; instead, the project uses a custom test asset with code `USDT` and a configurable issuer account.
4. Updated the Stellar testnet setup guide to describe the separated issuer/treasury model, trustline requirements, and the recommended minting flow.

## Files Changed

- `src/application/actions/testnet.ts`
- `src/app/testnet/page.tsx`
- `src/presentation/components/AdminDashboard.tsx`
- `docs/guides/stellar-testnet-setup.md`
- `docs/memory/index.md`

## Notes

- The active test setup now assumes:
  - `STELLAR_USDT_ASSET_CODE=USDT`
  - `STELLAR_USDT_ASSET_ISSUER=<separate testnet account>`
  - `STELLAR_TREASURY_PUBLIC_KEY=<different testnet account>`
- If the issuer and treasury are accidentally pointed to the same account, `/testnet` still warns that the account cannot hold a normal trustline balance of its own asset.

## Next Steps

1. Use `/testnet` to activate the issuer and treasury accounts with Friendbot if needed.
2. Create the treasury `USDT` trustline against the configured issuer.
3. Fund the treasury with test `USDT` from the issuer.
4. Continue deposit-flow validation against Trustless Work using those now-prepared testnet balances.
