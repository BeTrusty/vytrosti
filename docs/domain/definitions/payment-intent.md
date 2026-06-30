# Definition: Payment Intent

A Payment Intent represents a customer's commitment to pay for a booking. It links a specific Reservation with a leased pool Wallet to monitor the transaction on Stellar.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `reservation_id` (UUID): References the reservation.
- `wallet_id` (UUID): References the leased pool wallet.
- `amount_usdt` (Numeric): First payment required to confirm the reservation (rent subtotal + platform fee). The security deposit is tracked separately and secured later in escrow.
- `status` (Enum): `pending`, `paid`, `expired`.
- `expires_at` (Timestamp): Expiration timeline (typically 15-30 minutes).
- `tx_hash` (String): The transaction hash once matched.
- `created_at` (Timestamp): Creation date.

## Flow & Constraints
- Only one active Payment Intent can be linked to a single reservation at a time.
- Upon creation:
  1. Lease a wallet from the pool in `available` state, change its state to `assigned`.
  2. Record the expiration date.
- Upon polling:
  - If payment of `amount_usdt` is received in time, set Payment Intent to `paid`, move wallet to `settling`.
  - If expiration is reached without payment, set Payment Intent to `expired`, move wallet to `cooldown`.
