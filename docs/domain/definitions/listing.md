# Definition: Listing

A Listing represents a real estate property made available for temporary rental by an Owner.

## Key Attributes
- `id` (UUID): Unique internal identifier.
- `owner_id` (UUID): References the Owner who owns the property.
- `title` (String): Title of the property.
- `description` (String): Description of the property.
- `price_per_night_usdt` (Numeric): The price of renting the property for one night, denoted in USDT.
- `security_deposit_usdt` (Numeric): The collateral amount required to be placed in escrow, denoted in USDT.
- `images` (JSON Array): URLs of listing photos.
- `address` / `city` / `country` (String): Geolocation details.
- `created_at` (Timestamp): Creation timestamp.

## Constraints & Lifecycle
- Price per night and security deposit must be positive numbers.
- Deletions are soft-deleted or archived to avoid breaking active reservations.
