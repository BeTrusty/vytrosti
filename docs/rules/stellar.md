# Stellar and Wallet Pool Rules

This document outlines the rules for interacting with the Stellar Network and managing the payment Wallet Pool.

## The Wallet Pool Rule
- **No Memos**: Instead of using transaction memo IDs to match payments, we lease a dedicated ephemeral wallet to a reservation.
- **States**:
  - `available`: Ready to be assigned.
  - `assigned`: Leased to a reservation / payment intent.
  - `settling`: Transaction detected, payment captured, moving funds to Treasury/Escrow.
  - `cooldown`: Funds cleared, waiting a safe period (e.g., 1-2 blocks) before returning to `available`.
  - `disabled`: Maintenance or issues.

## Polling Rules
- **Cron Polling**: Running via Vercel Cron (every 1 minute).
- **Targeted Queries**: Only query Horizon endpoints for wallets in `assigned` or `settling` status. Never query `available` or `disabled` wallets to prevent Horizon rate-limiting.
- **Horizon Cursor**: Every pool wallet must store its `last_horizon_cursor` in the database. Polling must resume from that cursor.
- **Idempotency**: Polling must verify transaction hash IDs. The database should log transaction hashes inside `blockchain_transactions` to ensure no double-crediting occurs.

## Cryptography & Key Management
- **Encrypted Secret Keys**: Secret keys of pool wallets must never be stored in plain text. Encrypt them using AES-256-GCM via standard Node.js `crypto` with `STELLAR_POOL_SECRET_ENCRYPTION_KEY`.
- **Public Treasury Key**: Treasury public key receives rental cuts and fees. The Treasury secret key is strictly restricted to secure backend settlement actions.
