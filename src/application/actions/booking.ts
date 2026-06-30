'use server';

import { db } from '@/infrastructure/db/client';
import { listings, reservations, tenants, users, ledgerAccounts, paymentIntents, systemConfigs, wallets } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { walletPoolService } from '../services/wallet-pool';
import { ledgerService } from '../services/ledger';
import { stellarProvider } from '@/infrastructure/stellar/provider';
import { revalidatePath } from 'next/cache';
import { paymentPoller } from '../services/poller';
import { auth } from '@/infrastructure/auth/server';
import {
  createReservationDispute,
  requestReservationCheckout,
  settleReservationCheckout,
} from '../services/reservation-workflow';

export interface BookingResponse {
  success: boolean;
  reservationId?: string;
  paymentIntentId?: string;
  error?: string;
}

export async function createBooking(formData: {
  listingId: string;
  checkInStr: string;
  checkOutStr: string;
  tenantPublicKey?: string;
}): Promise<BookingResponse> {
  try {
    const sessionResponse = await auth.getSession();
    const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;
    if (!session) {
      return { success: false, error: 'You must be authenticated to create a reservation.' };
    }
    if (session.user.role === 'admin') {
      return { success: false, error: 'Admin accounts cannot create reservations.' };
    }

    const { listingId, checkInStr, checkOutStr, tenantPublicKey } = formData;

    if (!listingId || !checkInStr || !checkOutStr) {
      return { success: false, error: 'All fields are required' };
    }

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return { success: false, error: 'Invalid dates provided' };
    }

    if (checkOut <= checkIn) {
      return { success: false, error: 'Check-out must be after check-in' };
    }

    // Load listing details
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId),
    });

    if (!listing) {
      return { success: false, error: 'Listing not found' };
    }

    // Compute prices
    const nights = Math.max(
      1,
      Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    );

    const pricePerNight = parseFloat(listing.pricePerNightUsdt);
    const subtotal = pricePerNight * nights;
    const securityDeposit = parseFloat(listing.securityDepositUsdt);
    const platformFee = subtotal * 0.05; // 5% fee
    const firstPaymentAmount = subtotal + platformFee;

    // Locate or dynamically create public user record matching the authenticated session
    let userRecord = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });

    if (!userRecord) {
      const [newUser] = await db
        .insert(users)
        .values({
          name: session.user.name || session.user.email.split('@')[0],
          email: session.user.email,
        })
        .returning();
      userRecord = newUser;
    }

    // Locate or create tenant profile linked to the user
    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userRecord.id),
    });

    const activePublicKey = tenantPublicKey || tenant?.stellarPublicKey;
    if (!activePublicKey) {
      return { success: false, error: 'No guest profile configured. Please set up guest coordinates in the developer portal.' };
    }

    if (!tenant) {
      const [newTenant] = await db
        .insert(tenants)
        .values({
          userId: userRecord.id,
          stellarPublicKey: activePublicKey,
        })
        .returning();
      tenant = newTenant;

      // Initialize tenant ledger liability account
      await db.insert(ledgerAccounts).values({
        id: `liabilities:tenants:${tenant.id}`,
        name: `${userRecord.name} Refundable Deposits`,
        type: 'liability',
      });
    } else if (tenant.stellarPublicKey !== activePublicKey) {
      // If coordinates updated, keep it in sync
      await db
        .update(tenants)
        .set({ stellarPublicKey: activePublicKey })
        .where(eq(tenants.id, tenant.id));
    }

    // Create reservation in DB
    const [reservation] = await db
      .insert(reservations)
      .values({
        listingId,
        tenantId: tenant.id,
        checkIn,
        checkOut,
        subtotalUsdt: subtotal.toFixed(4),
        securityDepositUsdt: securityDeposit.toFixed(4),
        platformFeeUsdt: platformFee.toFixed(4),
        status: 'pending_payment',
      })
      .returning();

    // Lease a pool wallet and create the payment intent
    const paymentIntentId = await walletPoolService.leaseWallet(
      reservation.id,
      firstPaymentAmount.toFixed(4)
    );

    revalidatePath('/admin');
    revalidatePath(`/reservations/${reservation.id}`);

    return {
      success: true,
      reservationId: reservation.id,
      paymentIntentId,
    };
  } catch (error) {
    console.error('Error creating booking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// Manually triggers the payment poller for a specific payment intent.
// Called from the guest "Verify Payment" button — does NOT expose the cron endpoint.
export async function verifyPaymentStatus(paymentIntentId: string): Promise<{
  success: boolean;
  paymentDetected: boolean;
  status: string | null;
  error?: string;
}> {
  try {
    const intentBefore = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
    });

    if (!intentBefore) {
      return { success: false, paymentDetected: false, status: null, error: 'Payment intent not found' };
    }

    if (intentBefore.status === 'paid') {
      // Already confirmed — no need to poll again
      revalidatePath(`/reservations/${intentBefore.reservationId}`);
      return { success: true, paymentDetected: true, status: 'paid' };
    }

    // Run the full payment scanner
    await paymentPoller.pollPayments();

    // Snapshot status after polling
    const intentAfter = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
    });

    const detected = intentAfter?.status === 'paid';

    if (detected) {
      revalidatePath(`/reservations/${intentAfter!.reservationId}`);
      revalidatePath('/admin');
    }

    return { success: true, paymentDetected: detected, status: intentAfter?.status ?? null };
  } catch (error) {
    console.error('Error verifying payment status:', error);
    return {
      success: false,
      paymentDetected: false,
      status: null,
      error: error instanceof Error ? error.message : 'Ledger scanning failed',
    };
  }
}


// Simulates payment for mock testing in the frontend
export async function simulatePayment(
  walletId: string,
  fromAddress: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const txHash = await stellarProvider.simulatePaymentDeposit(walletId, fromAddress, amount);
    
    // Do NOT run the poller or refresh/revalidate path automatically to let the user verify manually
    
    return { success: true, txHash };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Request checkout & claim deposit (Guest action)
export async function requestCheckout(reservationId: string): Promise<{ success: boolean; error?: string }> {
  const result = await requestReservationCheckout(reservationId);
  return { success: result.success, error: result.error };
}

// Settlement & checkout process (Host approval or auto-expiration release)
export async function executeCheckoutSettlement(reservationId: string) {
  const result = await settleReservationCheckout(reservationId);
  return { success: result.success, error: result.error };
}

// Action to file a dispute
export async function fileDispute(reservationId: string, claimedAmount: string, reason: string) {
  const result = await createReservationDispute(reservationId, claimedAmount, reason);
  return { success: result.success, error: result.error };
}

// Submits a transfer either via mock simulation or real on-chain transaction
// signed on the server side using the guest's secret key from systemConfigs
export async function executeServerSignedTestnetPayment(paymentIntentId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const isMock = process.env.STELLAR_MOCK !== 'false';

    const intent = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
      with: {
        reservation: {
          with: {
            tenant: true,
          },
        },
        wallet: true,
      },
    });

    if (!intent) {
      return { success: false, error: 'Payment intent not found' };
    }

    const tenantPublicKey = intent.reservation.tenant.stellarPublicKey;
    
    // Lookup guest secret key in systemConfigs
    const secretConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, `test_user_secret_${tenantPublicKey}`),
    });

    if (isMock) {
      const result = await simulatePayment(intent.walletId, tenantPublicKey, intent.amountUsdt);
      if (result.success) {
        const txHash = result.txHash || 'mock_simulated_tx';

        if (intent.status === 'pending') {
          await db.transaction(async (tx) => {
            await tx
              .update(paymentIntents)
              .set({ status: 'paid', txHash })
              .where(eq(paymentIntents.id, intent.id));

            await tx
              .update(reservations)
              .set({ status: 'paid' })
              .where(eq(reservations.id, intent.reservationId));

            await tx
              .update(wallets)
              .set({ status: 'settling', lastPolledAt: new Date() })
              .where(eq(wallets.id, intent.walletId));
          });

          await ledgerService.postEntry(
            `Rental Payment Received for Reservation #${intent.reservationId.substring(0, 8)}`,
            [
              {
                accountPath: `assets:wallet_pool:${intent.wallet.publicKey}`,
                amount: intent.amountUsdt,
                direction: 'debit',
              },
              {
                accountPath: `liabilities:tenants:${intent.reservation.tenantId}`,
                amount: intent.amountUsdt,
                direction: 'credit',
              },
            ],
            'reservation',
            intent.reservationId
          );

          await paymentPoller.pollPayments();
        }

        revalidatePath('/admin');
        revalidatePath(`/reservations/${intent.reservationId}`);
        return { success: true, txHash };
      }
      return result;
    }

    // Real Testnet Mode: secret key is mandatory
    const guestSecretKey = secretConfig?.value;
    if (!guestSecretKey) {
      return { success: false, error: `Guest secret key for account ${tenantPublicKey.substring(0, 8)}... not found in database configuration.` };
    }

    const txHash = await stellarProvider.sendUsdc(guestSecretKey, intent.wallet.publicKey, intent.amountUsdt);
    return { success: true, txHash };
  } catch (error) {
    console.error('Server-signed payment execution failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Payment execution failed' };
  }
}
