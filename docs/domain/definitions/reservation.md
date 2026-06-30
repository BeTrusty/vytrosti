# Definition: Reservation

A Reservation captures the booking agreement between a Tenant and an Owner for a specific Listing over a range of dates.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `listing_id` (UUID): References the listing.
- `tenant_id` (UUID): References the tenant.
- `check_in` (Date): Check-in date.
- `check_out` (Date): Check-out date.
- `subtotal_usdt` (Numeric): Price per night * number of nights.
- `security_deposit_usdt` (Numeric): The required security deposit.
- `platform_fee_usdt` (Numeric): Fee charged by the platform.
- `status` (Enum): The current state of the booking.
- `created_at` (Timestamp): Creation timestamp.

## Status State Machine
```mermaid
stateDiagram-v2
  [*] --> pending_payment
  pending_payment --> paid : Stellar payment detected
  pending_payment --> cancelled : Timeout/Tenant cancels
  paid --> escrowed : Trustless Work deposit funded
  escrowed --> active : Check-in date reached
  active --> checking_out : Tenant checks out & claims refund
  checking_out --> completed : Host accepts / window expires
  checking_out --> disputed : Host opens dispute in review window
  disputed --> completed : Dispute resolved
  escrowed --> cancelled : Owner cancels before check-in (Refunds trigger)
```

- **pending_payment**: Reservation created, awaiting the first Stellar transfer.
- **paid**: Rent plus platform fee were confirmed and swept. The security deposit still needs its Trustless Work funding step.
- **escrowed**: The security deposit is locked in Trustless Work and the stay is fully protected.
- **active**: The guest has checked in.
- **checking_out**: The guest has checked out and claimed the deposit refund. Starts the configurable review window (default 72h).
- **completed**: Checkout settled, funds released to owner, deposit returned to tenant.
- **cancelled**: Reservation aborted, funds returned to respective parties.
- **disputed**: Collateral locked due to damage claims or complaints filed by the Host within the review window.
