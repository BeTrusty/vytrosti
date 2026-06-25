# Guía: Credenciales y Setup de Stellar Testnet

> **Audiencia**: Desarrolladores que quieren activar el flujo de pago real en Testnet de Stellar.
> El proyecto soporta dos modos: **mock** (default, sin red) y **testnet** (real, en blockchain).

---

## 1. Entendiendo el Modo Mock vs Testnet

| Variable | Valor | Comportamiento |
|---|---|---|
| `STELLAR_MOCK` | `true` (default) | Todos los pagos son simulados en DB. No hay conexión a Horizon. El simulador dev aparece en la UI. |
| `STELLAR_MOCK` | `false` | Pagos reales via Horizon Testnet. El simulador dev **desaparece** de la UI. |
| `TRUSTLESS_MOCK` | `true` (default) | Los escrows se crean como IDs ficticios en DB. |
| `TRUSTLESS_MOCK` | `false` | Los escrows se crean via API real de Trustless Work. |

**Para el hackathon en testnet**: setear `STELLAR_MOCK=false`.

---

## 2. Crear las Wallets Necesarias

Necesitás **3 tipos de wallets** en Testnet:

### 2.1 Wallet Tesorera (Treasury)

La tesorería recibe los fondos de renta + fees cuando se hace el sweep.

```bash
# Generá un keypair nuevo en el Stellar Laboratory:
# https://laboratory.stellar.org/#account-creator?network=test

# O usando la SDK desde Node.js:
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public Key:', kp.publicKey());
console.log('Secret Key:', kp.secret());
"
```

Después de generar, **fondear en el Testnet Friendbot**:
```
https://friendbot.stellar.org/?addr=<TU_PUBLIC_KEY>
```

O directamente en el Laboratory (tiene el botón "Fund with Friendbot").

### 2.2 Pool Wallets (Ephemeral)

Son wallets temporales que se asignan a cada reserva. Se necesitan al menos 2-3 para que el rotador funcione sin esperar.

```bash
# Correr el script de setup del pool (ya incluido en el proyecto):
# Esto genera keypairs, los funde en Friendbot, establece trustlines USDT,
# y los agrega encriptados a la DB.
npx tsx scripts/setup-pool-wallets.ts --count 3
```

> **Nota**: Este script aún no existe — ver sección 5 para crearlo manualmente vía Admin dashboard.

### 2.3 USDT Testnet Asset

El USDT en Testnet de Stellar es emitido por un issuer específico. Hay dos opciones:

**Opción A — USDT de Testnet oficial (recomendado para hackathon)**:
```
STELLAR_USDT_ASSET_CODE=USDT
STELLAR_USDT_ASSET_ISSUER=GCQTG2372RLF74OWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU67252
```
*(Este issuer ya está en el `.env.example`)*

**Opción B — Crear tu propio asset de test**:
En el Stellar Laboratory, crear una "Issue Asset" operation con tu propio issuer. Útil si el issuer del `.env.example` no está activo.

---

## 3. Configurar Variables de Entorno

Agregá las siguientes variables a tu `.env.local`:

```bash
# ── Activar modo real ─────────────────────────────────────────────
STELLAR_MOCK=false
TRUSTLESS_MOCK=false   # Si tenés API key de Trustless Work, sino dejarlo en true

# ── Red Stellar ───────────────────────────────────────────────────
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# ── Asset USDT en Testnet ─────────────────────────────────────────
STELLAR_USDT_ASSET_CODE=USDT
STELLAR_USDT_ASSET_ISSUER=GCQTG2372RLF74OWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU67252

# ── Treasury (recibe rentas y fees) ──────────────────────────────
STELLAR_TREASURY_PUBLIC_KEY=G...    # Tu public key generada en paso 2.1
STELLAR_TREASURY_SECRET_KEY=S...    # Tu secret key — NUNCA commitear esto

# ── Encriptación de secret keys del pool ─────────────────────────
# Debe ser exactamente 64 caracteres hexadecimales (32 bytes en AES-256)
STELLAR_POOL_SECRET_ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff

# Generá uno seguro con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ── Trustless Work (opcional para hackathon) ──────────────────────
TRUSTLESS_API_KEY=your_key_here
TRUSTLESS_API_URL=https://api.trustless.work

# ── Cron auth ────────────────────────────────────────────────────
CRON_SECRET=un_token_secreto_largo
```

> ⚠️ **NUNCA** commits secrets al repositorio. `.env.local` ya está en `.gitignore`.

---

## 4. Agregar Pool Wallets a la DB (Admin Dashboard)

El rotador de wallets necesita wallets disponibles en la tabla `wallets`.

### Opción A: Via Admin Dashboard (recomendado)

1. Ir a `http://localhost:3000/admin`
2. Tab **"Account Pool"**
3. En la sección "Add Wallet to Pool":
   - Ingresar el Public Key de una wallet Testnet fondeada
   - Ingresar su Secret Key (se encripta automáticamente con AES-256-GCM antes de guardarse en DB)
4. Repetir para 2-3 wallets

### Opción B: Via script Node.js

```bash
node -e "
const { Keypair } = require('@stellar/stellar-sdk');

// Generar 3 keypairs nuevos
for (let i = 0; i < 3; i++) {
  const kp = Keypair.random();
  console.log('--- Wallet', i+1, '---');
  console.log('Public:', kp.publicKey());
  console.log('Secret:', kp.secret());
}
" > pool-wallets.txt

# Después fondear cada public key en:
# https://friendbot.stellar.org/?addr=<PUBLIC_KEY>

# Y agregarlos via Admin Dashboard o directamente insertando en DB
```

### Establecer Trustline USDT en cada Pool Wallet

Las wallets del pool **deben tener trustline** con el asset USDT antes de poder recibir pagos.

```bash
# Esto se puede hacer via Stellar Laboratory:
# 1. Build Transaction → Source Account: <pool wallet public key>
# 2. Add Operation: Change Trust → Asset: USDT:GCQTG...7252
# 3. Sign + Submit

# O via el StellarProvider que ya tenemos:
node -e "
require('dotenv').config({ path: '.env.local' });
const { stellarProvider } = require('./src/infrastructure/stellar/provider.ts');
stellarProvider.establishUsdtTrustline('<SECRET_KEY_DE_LA_POOL_WALLET>');
"
```

---

## 5. Cómo Funciona el Validador (Payment Poller)

### ¿Qué hace?

El validador es `PaymentPoller.pollPayments()` en [`src/application/services/poller.ts`](../src/application/services/poller.ts).

Cada invocación:

```
1. processCooldowns()
   └─ Wallets en cooldown > 30s → vuelven a "available"

2. Para cada wallet en estado "assigned":
   └─ stellarProvider.pollWalletOperations(publicKey, lastCursor)
       └─ Llama a Horizon API: GET /accounts/<address>/operations?cursor=<cursor>
       └─ Filtra solo operaciones de tipo "payment" con asset USDT
   └─ Por cada transferencia detectada:
       └─ Verifica idempotencia: ¿ya está el txHash en blockchain_transactions?
       └─ Verifica monto: |actual - esperado| <= 0.0001 USDT
       └─ DB transaction:
           ├─ INSERT blockchain_transactions (idempotencia futura)
           ├─ UPDATE payment_intents → status = 'paid'
           ├─ UPDATE reservations → status = 'paid'
           └─ UPDATE wallets → status = 'settling'
       └─ Ledger entry: Debit pool wallet / Credit tenant liability

3. Para cada wallet en estado "settling":
   └─ trustlessProvider.createEscrow(deposit) → contractAddress + escrowId
   └─ stellarProvider.sendUsdt(treasury, rent+fee)   → sweep renta
   └─ stellarProvider.sendUsdt(contractAddress, deposit) → fondo escrow
   └─ DB transaction:
       ├─ INSERT escrows
       ├─ UPDATE reservations → status = 'escrowed'
       └─ UPDATE wallets → status = 'cooldown'
   └─ Ledger entry (7 líneas balanceadas)
```

### ¿Cómo correrlo manualmente?

**Opción 1 — Botón en la UI (Guest o Host)**:
En `/reservations/[id]` cuando `status = 'pending_payment'`, hacer click en **"Verify Payment"**.
Esto llama a `verifyPaymentStatus()` → `pollPayments()` → toast con resultado.

**Opción 2 — Desde el Admin Dashboard**:
Tab **"Settings"** → botón **"Trigger Payment Scanner"**.

**Opción 3 — Endpoint HTTP directo**:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  http://localhost:3000/api/cron/poll-payments
```

Respuesta exitosa:
```json
{
  "success": true,
  "message": "Stellar and Trustless ledger scanning execution finished successfully",
  "data": { "processedCount": 1, "sweptCount": 1 }
}
```

**Opción 4 — Vercel Cron (Producción)**:
Agregar a `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/poll-payments",
    "schedule": "* * * * *"
  }]
}
```

---

## 6. Flujo Completo en Testnet (Paso a Paso)

```
[Setup]
  1. Crear Treasury wallet en Stellar Laboratory → fondear con Friendbot
  2. Crear 3 Pool wallets → fondear → establecer trustlines USDT
  3. Configurar .env.local con STELLAR_MOCK=false + keys
  4. Agregar pool wallets al Admin Dashboard
  5. npm run dev

[Pago de Reserva]
  6. Guest crea reserva en /listings/[id] → ingresa su Stellar public key
  7. Sistema asigna pool wallet (available → assigned)
  8. Guest ve QR en /reservations/[id] → escanea con app Stellar
  9. Guest envía exactamente X USDT al address mostrado (sin memo)
  10. Guest hace click "Verify Payment" (o espera 60s si está en Vercel)
      └─ poller detecta el pago
      └─ Toast: "Transfer confirmed! Reservation is now active."
      └─ Wallet pasa a "settling" → sweep renta → fondo escrow
      └─ Reservation pasa a "escrowed"

[Checkout]
  11. Guest hace click "Checkout & Release Funds"
      └─ Trustless Work libera escrow
      └─ Toast: "Checkout complete!"
      └─ Reservation → "completed"
```

---

## 7. Troubleshooting Común

| Error | Causa | Solución |
|---|---|---|
| `STELLAR_USDT_ASSET_ISSUER is required` | Falta variable de entorno | Agregar a `.env.local` |
| `No pool wallet available` | Pool vacío o todas assigned | Agregar más wallets al pool |
| `amount mismatch` en poller | El guest envió un monto diferente | Enviar el monto exacto del QR |
| `Horizon server not initialized` | `STELLAR_MOCK` no es `'false'` | Setear `STELLAR_MOCK=false` en `.env.local` |
| QR no muestra simulador | `STELLAR_MOCK=false` en producción | Comportamiento esperado ✅ |
| Toast no aparece | `ToastProvider` no montado | Verificar `src/app/providers.tsx` |
