# Session 0010: Testnet Developer Setup Page and Programmatic Funding

- **Date**: 2026-06-29
- **Objectives**:
  1. Build a developer setup page (`/testnet`) to manage developer keys and programmatically fund testnet accounts.
  2. Implement deterministic account derivation from master developer credentials to support multiple pool accounts.
  3. Support programmatic funding of XLM (via Friendbot) and USDC/USDT (via on-chain transactions or mock simulation).
  4. Integrate block explorer links (StellarExpert) to inspect payments and transfers.
  5. Add a Test User Accounts section to manage seeded platform users (Hosts/Guests), generate real keypairs for them in the DB, cache secrets locally, and fund/sync their balances.

## Decisions

### 1. Environmental vs Client-side Keys
- **Check Environment First**: Added backend logic (`getMasterKeysConfig`) to check if master developer keys (`STELLAR_DEV_PUBLIC_KEY` and `STELLAR_DEV_SECRET_KEY`) are defined in the environment.
- **Read-Only Mode**: If defined, they are used directly and displayed as "Environment Configured" (read-only) on the UI.
- **Client Fallback**: If not defined in the environment, the browser falling back to `localStorage` is used, allowing on-the-fly generation and local persistence.

### 2. Deterministic Derivation ("Con las mismas llaves")
- **Ed25519 Seed Generation**: Instead of external mnemonic libraries, we use Node's native `crypto.createHash('sha256')` to hash `masterSecretKey + '_' + index`.
- **Unique Account Keys**: We pass this deterministic 32-byte hash to `StellarSdk.Keypair.fromRawEd25519Seed` to derive unique derived accounts. These are saved to the `wallets` table in the database and registered in `ledgerAccounts`.

### 3. Programmatic Funding & Explorer Links
- **Dual Mode Funding**: Funder logic checks `STELLAR_MOCK`. In mock mode, simulated deposits are inserted into `blockchainTransactions` to ensure immediate test cycles. In real testnet mode, Friendbot is used to activate XLM, a Change Trust operation is sent to trust USDC/USDT, and treasury keys are used to pay/mint the assets.
- **DEX Path Payment for USDC**: Since the Treasury is not the issuer of USDC, we implemented a `pathPaymentStrictReceive` from the destination account's own Friendbot-funded XLM to swap for USDC directly on the Stellar DEX. This makes USDC funding 100% self-sufficient.
- **Explorer Tracking**: Included links pointing to StellarExpert (`https://stellar.expert/explorer/testnet/account/${publicKey}`) for direct validation of transfers and payment structures.

### 4. Test User Accounts Management
- **User Keypairs**: Added queries (`getTestUsersAction`) to pull all seeded users from the database. Added actions (`updateUserPublicKeyAction`) to update the public key of the host (owner) or guest (tenant) records.
- **Secrets Cache**: Generated secret keys are stored in the developer's local storage (`vytrosti_test_user_secret_<publicKey>`), enabling the UI to sign trustline creations and DEX swaps automatically when funding them.

## Files Created / Modified
- `src/application/actions/testnet.ts` (Created)
- `src/app/testnet/page.tsx` (Created)
- `src/presentation/components/Navbar.tsx` (Modified)
- `docs/guides/stellar-testnet-setup.md` (Modified)
- `.env.example` (Modified)
- `docs/memory/index.md` (Modified)
- `docs/memory/sessions/0010-testnet-developer-setup.md` (Created)

## Next Steps
- Verify the newly created page on browser and run the testnet verification tests.
