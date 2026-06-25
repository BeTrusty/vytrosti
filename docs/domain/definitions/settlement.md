# Definition: Settlement

A Settlement is the final reconciliation step of a reservation where rental funds are split between Owner, Tenant, and Platform, and all escrows are closed.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `reservation_id` (UUID): References the reservation.
- `total_rent_usdt` (Numeric): Subtotal rent paid by the tenant.
- `platform_fee_usdt` (Numeric): Cut retained by the platform.
- `owner_share_usdt` (Numeric): Funds routed to the owner (`total_rent_usdt - platform_fee_usdt`).
- `security_deposit_refund_usdt` (Numeric): Portion of deposit returned to tenant.
- `security_deposit_retained_usdt` (Numeric): Portion of deposit paid to owner.
- `settled_at` (Timestamp): Settlement completion time.

## Flow & Constraints
- Triggered on check-out (normal checkout releases subtotal to owner, deposit to tenant).
- Triggered on cancellation (refund allocations depend on cancellation policies).
- Generates balancing double-entry ledger lines to close temporary holding accounts.
