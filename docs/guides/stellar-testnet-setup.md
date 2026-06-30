# Guía: Credenciales y Setup de Stellar Testnet

> **Audiencia**: Desarrolladores que quieren activar el flujo de pago real en Testnet de Stellar.
> El proyecto soporta dos modos: **mock** (default, sin red) y **testnet** (real, en blockchain).

---

## 1. Entendiendo el Modo Mock vs Testnet

| Variable | Valor | Comportamiento |
|---|---|---|
| `STELLAR_MOCK` | `true` (default) | Todos los pagos son simulados en DB. No hay conexión a Horizon. El simulador dev aparece en la UI. |
| `STELLAR_MOCK` | `false` | Pagos reales via Horizon Testnet. El simulador dev **desaparece** de la UI. |
| `TRUSTLESS_MOCK` | `true` (default) | El depósito protegido se simula en DB y la reserva avanza a `escrowed` sin tocar la red. |
| `TRUSTLESS_MOCK` | `false` | El depósito protegido usa el SDK React de Trustless Work, firma envelopes desde el backend dev y fondea el escrow real. |

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

### 2.3 USDT Test Asset

No existe "USDT real" de mainnet dentro de Stellar Testnet. En testnet solo podés usar un **asset de prueba** con el código `USDT`, emitido por la cuenta que vos configures como issuer.

La recomendación para desarrollo es:

```bash
STELLAR_USDT_ASSET_CODE=USDT
STELLAR_USDT_ASSET_ISSUER=G...   # una cuenta testnet que controle tu equipo
```

Configuración sugerida:
1. Usar una cuenta testnet separada como issuer.
2. Mantener la tesorería en otra cuenta distinta.
3. Hacer que la tesorería cree trustline hacia ese issuer.
4. Emitir `USDT` desde el issuer y luego transferirlo a tesorería, hosts, guests o wallets del pool.

> Si usás la misma cuenta como issuer y tesorería, esa cuenta puede emitir el asset pero no mantener una trustline normal de su propio `USDT`.

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
STELLAR_USDT_ASSET_ISSUER=G...    # cuenta issuer testnet separada

# ── Treasury (recibe rentas y fees) ──────────────────────────────
STELLAR_TREASURY_PUBLIC_KEY=G...    # cuenta treasury testnet separada del issuer
STELLAR_TREASURY_SECRET_KEY=S...    # Tu secret key — NUNCA commitear esto

# ── Encriptación de secret keys del pool ─────────────────────────
# Debe ser exactamente 64 caracteres hexadecimales (32 bytes en AES-256)
STELLAR_POOL_SECRET_ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff

# Generá uno seguro con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ── Trustless Work (depósito protegido) ───────────────────────────
TRUSTLESS_API_KEY=your_key_here
TRUSTLESS_API_URL=https://api.trustlesswork.com

# Opcional: si tu key ya es public-safe y preferís exponerla al cliente
# NEXT_PUBLIC_TRUSTLESS_API_KEY=your_key_here

# ── Cron auth ────────────────────────────────────────────────────
CRON_SECRET=un_token_secreto_largo
```

> ⚠️ **NUNCA** commits secrets al repositorio. `.env.local` ya está en `.gitignore`.

---

### Opción C: Via Testnet Setup Page (Recomendado para desarrollo/test)

El proyecto incluye una página dedicada a la configuración de Testnet en `/testnet`:
1. Navegar a `/testnet` (es accesible para administradores autenticados).
2. **Definir Claves Maestras**: 
   - Si tenés las variables `STELLAR_DEV_PUBLIC_KEY` y `STELLAR_DEV_SECRET_KEY` configuradas en tu archivo `.env.local`, la página las leerá automáticamente y las mostrará como "Configuradas en el Entorno" (modo lectura).
   - De lo contrario, podés presionar **"Generate Keys"** para crear un par de claves maestras al vuelo. Estas claves se persistirán en la base de datos (tabla `system_configs`) de forma que estén disponibles de manera consistente a través de diferentes navegadores, sesiones y flujos de pruebas automatizadas en el servidor. Adicionalmente se cachean en el `localStorage` de tu navegador.
3. **Fondear Cuenta Maestra**: Podés hacer click en **"Fund Master (Friendbot)"** para fondear la cuenta maestra con XLM en la red de pruebas.
4. **Derivar y Registrar Cuentas**:
   - Ingresá la cantidad $N$ de cuentas que querés crear (por ejemplo, 5).
   - Hacé click en **"Derive & Register in DB"**. Esto generará $N$ cuentas de forma determinista usando la clave secreta maestra, las registrará automáticamente en la tabla `wallets` de la base de datos (con estado `available` encriptando sus claves privadas con AES-256-GCM) y creará sus correspondientes coordenadas contables (`ledgerAccounts`).
5. **Carga Programática de Saldo**:
   - Una vez creadas las cuentas, las verás en la tabla de la derecha.
   - Hacé click en **"Fund USDC"** o **"Fund USDT"** al lado de la cuenta correspondiente.
   - En **Modo Mock**, esto simulará instantáneamente el depósito en la base de datos para pruebas veloces.
   - En **Modo Real (Testnet)**, el sistema activará la cuenta con Friendbot, establecerá la línea de confianza (trustline) correspondiente y transferirá los tokens automáticamente.
   - Para `USDT`, la emisión sale desde la cuenta configurada en `STELLAR_USDT_ASSET_ISSUER`.
   - Para `USDC`, el fondeo sigue el camino de testnet basado en DEX/path payment.
6. **Treasury Account Controls**:
   - La misma página ahora muestra una tarjeta dedicada para la cuenta de tesorería configurada.
   - Desde ahí podés:
     - sincronizar balances de `XLM`, `USDC` y `USDT`,
     - activar la cuenta con Friendbot,
     - crear trustlines de `USDC` y `USDT`,
     - y fondearla con activos compatibles.
   - La tarjeta también muestra qué cuenta está configurada como issuer de `USDT` y te enlaza al explorer.
   - Si la tesorería coincide con el issuer de `USDT`, la UI lo advierte explícitamente porque esa misma cuenta no puede mantener una trustline normal de su propio asset.
7. **Transferencias Entre Cuentas Configuradas**:
   - `/testnet` también incluye un panel para mover `USDC` o `USDT` entre cuentas ya configuradas en el sistema:
     - tesorería,
     - issuer configurado de `USDT`,
     - cuenta maestra de desarrollo,
     - cuentas del pool,
     - cuentas de hosts,
     - cuentas de guests.
   - La transferencia prepara automáticamente la trustline de destino si la secret correspondiente está disponible.
8. **Verificar Movimientos**:
   - Al lado de cada cuenta hay un enlace llamado **"Explorer"** que te redirige a StellarExpert para visualizar todas las transferencias, pagos y trustlines en tiempo real.

### Establecer Trustline USDT en cada Pool Wallet

Las wallets del pool **deben tener trustline** con el asset USDT antes de poder recibir pagos.

```bash
# Esto se puede hacer via Stellar Laboratory:
# 1. Build Transaction → Source Account: <pool wallet public key>
# 2. Add Operation: Change Trust → Asset: USDT:<STELLAR_USDT_ASSET_ISSUER>
# 3. Sign + Submit

# O via el StellarProvider que ya tenemos:
node -e "
require('dotenv').config({ path: '.env.local' });
const { stellarProvider } = require('./src/infrastructure/stellar/provider.ts');
stellarProvider.establishUsdtTrustline('<SECRET_KEY_DE_LA_POOL_WALLET>');
"
```

### Flujo recomendado para probar un `USDT` de test

1. Activar con Friendbot la cuenta issuer y la tesorería.
2. Crear la trustline `USDT` en tesorería desde `/testnet`.
3. Emitir `USDT` hacia tesorería usando el botón de fondeo.
4. Desde la misma página, transferir `USDT` desde tesorería o issuer hacia hosts, guests o wallets del pool.

Ese flujo replica el comportamiento de un asset emitido por terceros, pero enteramente dentro de testnet.

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
   └─ stellarProvider.sendUsdt(treasury, rent+fee) → sweep renta
   └─ UPDATE wallets → status = 'cooldown'
   └─ Ledger entry: Treasury debit / owner liability credit / fee revenue credit

4. Cuando la reserva ya está en `paid`:
   └─ Guest abre `/reservations/[id]`
   └─ Click en "Secure Deposit with Trustless Work"
   └─ useInitializeEscrow() → unsigned envelope
   └─ POST /api/trustless/sign-transaction → firma backend con la key dev del guest
   └─ useSendTransaction() → crea el escrow
   └─ useFundEscrow() → unsigned envelope de funding
   └─ POST /api/trustless/sign-transaction → segunda firma backend
   └─ useSendTransaction() → fondea el escrow
   └─ POST /api/trustless/escrows/record → INSERT/UPDATE escrows, reservation.status='escrowed'
   └─ Ledger entry: Debit assets:escrow:trustless:<contractId> / Credit liabilities:tenants:<tenantId>
```

### ¿Cómo correrlo manualmente?

**Opción 1 — Botón en la UI (Guest o Host)**:
En `/reservations/[id]` cuando `status = 'pending_payment'`, hacer click en **"Verify Payment"**.
Esto llama a `verifyPaymentStatus()` → `pollPayments()` → toast con resultado.

**Paso siguiente — Botón de depósito protegido**:
En `/reservations/[id]` cuando `status = 'paid'`, hacer click en **"Secure Deposit with Trustless Work"**.
Esto crea el escrow, lo fondea y recién ahí mueve la reserva a `escrowed`.

**Panel de demo en la UI**:
En el portal de pago también aparece una tarjeta de apoyo visual para hackathon review:
- `Local preview`: ejecuta una transferencia local simulada sin tocar la red.
- `Guest account`: firma y envía la transferencia de review usando el acceso guardado del guest.
- `Platform fallback`: si no existe acceso guardado del guest, envía la transferencia de review desde la cuenta demo de la plataforma.
Después de cualquiera de esos caminos, el siguiente paso sigue siendo **"Verify Payment"** para confirmar el estado.

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
