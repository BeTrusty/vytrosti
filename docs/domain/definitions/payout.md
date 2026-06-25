# Definition: Payout

A Payout tracks an outbound transfer of Stellar USDT from the platform's treasury or pool wallets to external wallets (Owners or Tenants).

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `reservation_id` (UUID): References the reservation that triggered the payout.
- `recipient_address` (String): Stellar public key receiving the funds.
- `amount_usdt` (Numeric): Funds to transfer.
- `payout_type` (Enum): `owner_rent`, `tenant_refund`, `platform_fee`.
- `status` (Enum): `pending`, `processing`, `completed`, `failed`.
- `tx_hash` (String): Stellar transaction hash.
- `created_at` (Timestamp): Creation date.
- `completed_at` (Timestamp): Success date.

## Flow & Safety
- Payouts must be idempotent. Every payout is assigned a unique reference.
- Payout transactions must be logged in the double-entry ledger before they are broadcast, and marked `completed` once confirmed.
