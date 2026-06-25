# Definition: Tenant

A Tenant is a user who books temporary accommodation (listings) on the Vytrosti platform.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `stellar_public_key` (String): The public key of the tenant's wallet. Used to verify identity, sign transactions, or receive refunds.
- `created_at` (Timestamp): Record creation date.

## Constraints & Lifecycle
- Tenants can act anonymously. In a PoC context, a session cookie or local wallet key represents a tenant.
- A Tenant has many Reservations.
