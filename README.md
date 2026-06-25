# Vytrosti

Vytrosti is a premium temporary rental platform leveraging Stellar USDT payments and Trustless Work escrow smart contracts. 

The platform guarantees secure deposits for tenants and payment guarantees for property owners without custodial escrows, utilizing double-entry bookkeeping ledgers and Stellar testnet pool rotation accounts.

---

## 🏗️ Architecture & Core Rules

Vytrosti follows a strict domain-driven architecture designed for high security and transactional auditability:

1. **Separation of Concerns**: Domain logic is strictly separated from infrastructure services (Stellar, Trustless Work, database client).
2. **Double-Entry Ledger Balancing**: Every single reservation ledger entry balances debits and credits:
   $$\sum \text{Debit} == \sum \text{Credit}$$
3. **No Custodial Escrow**: All security deposits route through smart contracts via Trustless Work.
4. **Wallet Pool Rotator**: Ephemeral pool accounts rotate states (`available` -> `assigned` -> `settling` -> `cooldown`) to detect and match payments safely without relying on transaction memos.
5. **No Crypto Jargon**: Client-facing copy replaces blockchain terms (e.g., *Wallet* $\rightarrow$ *Coordinates*, *Transaction* $\rightarrow$ *Transfer*, *Blockchain* $\rightarrow$ *Protocol*).

For details, refer to the project rule files under [`docs/rules/`](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/):
- [Architecture Guidelines](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/architecture.md)
- [Stellar Integration Details](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/stellar.md)
- [Trustless Work Contracts](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/trustless.md)
- [Ledger Rules](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/ledger.md)
- [UI & Design System (Vitrosti Precision)](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/ui.md)
- [Definition of Done & Compliance](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/rules/definition-of-done.md)

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js**: `v20` or higher
- **PostgreSQL**: A running instance (or Neon Serverless Postgres URL)

### 📦 Installation

Install all required dependencies:
```bash
npm install
```

### ⚙️ Database Setup

Run database migrations and seed default listings/mock users:
```bash
# Run migrations & seed data
npm run db:setup
```

Or run them individually:
```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

---

## ⚡ Development & Scripts

- **Development Server**: Start Next.js in development mode.
  ```bash
  npm run dev
  ```
- **Production Build**: Compile the TypeScript project and generate the Next.js optimized build.
  ```bash
  npm run build
  ```
- **Compliance Scanner (Verify Done)**: Verify that all code meets the security, linting, and architectural standards before committing.
  ```bash
  npm run verify-done
  ```

---

## 💳 Stellar Testnet Integration

Vytrosti supports both mock operations and real Stellar Testnet operations.

- **QR-Based Payments**: Reservations display a secure QR code and copyable Stellar coordinates to pay using any Stellar wallet.
- **Manual Verification**: Guests and hosts can trigger the payment verification poller directly from the UI to update the reservation status instantly.
- **Toasts for Feedback**: Real-time progress, errors, and success statuses are indicated in modern toast notifications powered by HeroUI.

### 📖 Setup Guide
For step-by-step instructions on setting up Testnet credentials, establishing USDT trustlines, and running/triggering the validator poller, please refer to the:
👉 **[Stellar Testnet Setup Guide](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/guides/stellar-testnet-setup.md)**

### 🔑 Authentication Guide
For testing login flows, Neon Auth, and sessions locally:
👉 **[Testing Authentication Guide](file:///Users/gpilla/Workspace/betrusty/vytrosti/docs/testing_auth_guide.md)**
