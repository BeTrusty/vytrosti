# Guía: Flujo de Depósito con Trustless Work SDK

> **Audiencia**: Desarrollo local y demo hackathon.
> **Objetivo**: mover una reserva desde `paid` hacia `escrowed` usando el SDK React de Trustless Work.

## Resumen del flujo

1. La reserva arranca en `pending_payment`.
2. El huésped paga sólo renta + fee y el escáner la mueve a `paid`.
3. En `/reservations/[id]` aparece el panel **Secure the Deposit**.
   - El portal de pago queda en la columna izquierda.
   - Cuando el primer pago ya fue confirmado, esa misma columna izquierda resume el estado de **First payment** y **Security deposit**.
   - Debajo de ese resumen aparece la card **Money route**, que deja visible la ruta completa del dinero entre huésped, cuenta temporal asignada, treasury de Vytrosti, cuenta del host y cuenta protegida del depósito.
   - Ese bloque de **Payment Status** debe distinguir explícitamente si el depósito fue `Returned`, `Retained`, `Partially retained` o `In dispute`; no debe quedarse en un estado genérico de protección cuando el escrow ya se resolvió.
   - Si el depósito ya existe, ese resumen también muestra links al contrato en Stellar Expert y al viewer de Trustless Work.
   - La columna derecha muestra el progreso del flujo y destaca **Secure the Deposit** como paso actual.
4. Ese panel usa el SDK:
   - `useInitializeEscrow()` para pedir el envelope de creación.
   - `useFundEscrow()` para pedir el envelope de funding.
   - `useSendTransaction()` para publicar cada envelope ya firmado.
5. Antes de llamar a Trustless Work, el panel valida las cuentas críticas:
   - `POST /api/trustless/preflight`
   - verifica `receiver` (host)
   - verifica `platformAddress` (treasury/platform)
   - confirma que cada cuenta exista en Stellar
   - confirma que cada cuenta ya tenga trustline del asset configurado
   - si alguna falla, muestra el bloqueo con link directo a Stellar Expert
6. La firma no ocurre en el navegador:
   - `POST /api/trustless/sign-transaction`
   - el backend busca `test_user_secret_<guestPublicKey>` en `system_configs`
   - firma el envelope y devuelve `signedXdr`
7. Al completar funding:
   - `POST /api/trustless/escrows/record`
   - se persiste `contractAddress`, `trustlessEscrowId`, `amountUsdt`
   - `reservation.status` pasa a `escrowed`
   - se registra el asiento contable balanceado del depósito

## Variables requeridas

```bash
STELLAR_NETWORK=testnet
STELLAR_TREASURY_PUBLIC_KEY=G...
STELLAR_USDT_ASSET_ISSUER=G...
TRUSTLESS_MOCK=false
TRUSTLESS_API_KEY=...
TRUSTLESS_API_URL=https://api.trustlesswork.com
```

## Modo mock

Si `TRUSTLESS_MOCK=true`, el panel usa `POST /api/dev/mock-escrow` en lugar del SDK remoto.
Eso permite validar UI, DB y ledger sin tocar la red.

## Cómo probarlo

1. Crear o abrir una reserva.
2. Confirmar el primer pago hasta que la reserva quede en `paid`.
3. Verificar que exista la secret key de desarrollo del huésped en `system_configs`.
4. Confirmar que la cuenta del host y la cuenta de plataforma estén activas y ya confíen el asset USDT.
5. Abrir la reserva y presionar **Secure Deposit with Trustless Work**.
6. Confirmar:
   - la tarjeta derecha avanza del paso de depósito al estado de estadía activa
   - la card **Money route** marca como `Protected` el tramo `Guest account -> Protected deposit account`
   - `reservations.status = 'escrowed'`
   - `escrows.status = 'funded'`
   - existe un ledger entry de `Deposit Secured`

## Checkout-only demo controls

- Los controles de sandbox para barrer expiraciones o ajustar la ventana de revisión sólo deben mostrarse cuando `reservation.status = 'checking_out'`.
- Antes de checkout, la UI debe enfocarse en pago, depósito y estado de la estadía sin adelantar herramientas de cierre.
- Las mutaciones de checkout, release y dispute ya no dependen del protocolo de Server Actions para el cliente. La UI llama route handlers JSON en `/api/reservations/[id]/checkout` y `/api/reservations/[id]/dispute`, y recién entonces hace `router.refresh()`.
- Si una revalidación posterior falla, `src/app/reservations/[id]/error.tsx` muestra una superficie de reintento específica de la reserva en lugar del error genérico de Next.js.

## Archivos clave

- `src/presentation/components/DepositEscrowPanel.tsx`
- `src/presentation/components/ReservationDetails.tsx`
- `src/app/api/reservations/[id]/checkout/route.ts`
- `src/app/api/reservations/[id]/dispute/route.ts`
- `src/application/services/reservation-workflow.ts`
- `src/app/api/trustless/preflight/route.ts`
- `src/app/api/trustless/sign-transaction/route.ts`
- `src/app/api/trustless/escrows/record/route.ts`
- `src/application/services/reservation-escrow.ts`
