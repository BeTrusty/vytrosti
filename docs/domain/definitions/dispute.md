# Definition: Dispute

A Dispute occurs when an Owner makes a claim against the Tenant's security deposit, or when a Tenant contests the terms of a deposit retention.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `escrow_id` (UUID): References the escrow record.
- `reservation_id` (UUID): References the booking.
- `claimed_amount_usdt` (Numeric): The amount the owner seeks to retain (up to the max security deposit).
- `reason` (String): Text description of the damage or breach.
- `status` (Enum): `active`, `resolved_to_tenant`, `resolved_to_owner`, `split_resolution`.
- `resolution_details` (String): Notes on how the dispute was resolved.
- `created_at` (Timestamp): Creation date.
- `resolved_at` (Timestamp): Date of dispute resolution.

## Flow & Resolution
1. **Initiate**: Owner opens a dispute before the escrow is released. Escrow moves to `disputed` status on-chain.
2. **Review**: Platform administrator reviews evidence (photos, text).
3. **Resolve**: Admin triggers a resolution which invokes the Trustless Work contract payout release functions to divide funds.
