# Definition: Owner

An Owner is a user who lists properties for rent on the platform and receives payouts in USDT.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `stellar_public_key` (String): The public key where the owner receives rental payouts.
- `created_at` (Timestamp): Record creation date.

## Constraints & Lifecycle
- Every listing must belong to exactly one Owner.
- Payouts are routed directly to the Owner's Stellar Public Key at settlement.
