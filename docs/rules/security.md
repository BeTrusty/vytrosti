# Security Rules

This document governs keys, encryption, and authorization across Vytrosti.

## Secret Keys Encryption
- **Encrypted in DB**: Any Stellar private key (seed) held in the Database for Wallet Pool automation must be encrypted before persistence.
- **Algorithm**: `aes-256-gcm` using a secure encryption key (`STELLAR_POOL_SECRET_ENCRYPTION_KEY`).
- **Storage**: Store the encrypted hex string, the initialization vector (IV), and the authentication tag.

## Environment Variables
- Never log private keys or raw environment configurations.
- Verify environment parameters at startup. Throw if vital keys like `STELLAR_TREASURY_SECRET_KEY` or `TRUSTLESS_API_KEY` are missing.

## Endpoint Protections
- **Vercel Cron validation**: The `polling` cron endpoint must validate the `Authorization: Bearer <CRON_SECRET>` header. Rejects all unauthenticated requests.
- **No Private Keys Exposed**: The frontend/client must never receive, read, or print any secret keys (`STELLAR_TREASURY_SECRET_KEY` or pool private keys).
