# Trustless Work Escrow Rules

This document outlines the rules for integrating with Trustless Work's Escrow protocol.

## Core Integration Rules
- **No Self-Managed Escrows**: We do not store or hold security deposits in platform wallets. All deposits must route through Trustless Work.
- **Mock First**: The integration must check a `TRUSTLESS_MOCK` flag or environment logic to facilitate local development and verification without active contract deployments.

## Trustless API Operations
- **Creation**: Triggered when a booking moves from `paid` to `escrowed`. A contract is initialized on Trustless Work, lock-in duration set, and payout destinations defined.
- **Refresh**: Polling endpoints to synchronize contract state (e.g. funded, released, disputed).
- **Release**: Release deposit back to tenant upon successful reservation completion.
- **Retain**: Release deposit to owner in case of tenant damage (must be mutually agreed or adjudicated).
- **Disputes**: Open dispute if there is a conflict. Arbitrate based on platform dashboard resolutions.
