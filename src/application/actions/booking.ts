'use server';

import { db } from '@/infrastructure/db/client';
import { listings, reservations, tenants, escrows, disputes } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { walletPoolService } from '../services/wallet-pool';
import { ledgerService } from '../services/ledger';
import { trustlessProvider } from '@/infrastructure/trustless/provider';
import { stellarProvider } from '@/infrastructure/stellar/provider';
import { revalidatePath } from 'next/cache';
import { paymentPoller } from '../services/poller';
import { auth } from '@/infrastructure/auth/server';

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
  tenantPublicKey: string;
}): Promise<BookingResponse> {
  try {
    const sessionResponse = await auth.getSession();
    const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;
    if (!session) {
      return { success: false, error: 'You must be authenticated to create a reservation.' };
    }

    const { listingId, checkInStr, checkOutStr, tenantPublicKey } = formData;

    if (!listingId || !checkInStr || !checkOutStr || !tenantPublicKey) {
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
    const totalAmount = subtotal + securityDeposit + platformFee;

    // Create or locate tenant
    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.stellarPublicKey, tenantPublicKey),
    });

    if (!tenant) {
      const [newTenant] = await db
        .insert(tenants)
        .values({
          stellarPublicKey: tenantPublicKey,
        })
        .returning();
      tenant = newTenant;
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
      totalAmount.toFixed(4)
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
  status?: string;
  error?: string;
}> {
  try {
    // Snapshot status before polling
    const { paymentIntents } = await import('@/infrastructure/db/schema');
    const { eq } = await import('drizzle-orm');

    const intentBefore = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
    });

    if (!intentBefore) {
      return { success: false, paymentDetected: false, error: 'Payment intent not found' };
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

    return { success: true, paymentDetected: detected, status: intentAfter?.status };
  } catch (error) {
    console.error('Error verifying payment status:', error);
    return {
      success: false,
      paymentDetected: false,
      error: error instanceof Error ? error.message : 'Ledger scanning failed',
    };
  }
}

// Simulates payment for mock testing in the frontend
export async function simulatePayment(walletId: string, fromAddress: string, amount: string) {
  try {
    await stellarProvider.simulatePaymentDeposit(walletId, fromAddress, amount);
    
    // Immediately run a poll execution to advance states
    await paymentPoller.pollPayments();
    
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Settlement & checkout process
export async function executeCheckoutSettlement(reservationId: string) {
  try {
    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      with: {
        listing: {
          with: {
            owner: true,
          },
        },
        escrows: true,
      },
    });

    if (!reservation) throw new Error('Reservation not found');
    if (reservation.status !== 'escrowed' && reservation.status !== 'active') {
      throw new Error('Reservation is not in a valid state for checkout');
    }

    const escrow = reservation.escrows[0];
    if (!escrow) throw new Error('Security deposit escrow contract not found');

    const ownerPublicKey = reservation.listing.owner.stellarPublicKey;
    const tenantPublicKey = reservation.tenantId; // Internal ID for ledger path

    // 1. Trigger release on Trustless Work
    const success = await trustlessProvider.releaseEscrow(escrow.trustlessEscrowId!);
    if (!success) throw new Error('Failed to release escrow via Trustless Work');

    // 2. Database update
    await db.transaction(async (tx) => {
      await tx
        .update(reservations)
        .set({ status: 'completed' })
        .where(eq(reservations.id, reservationId));

      await tx
        .update(escrows)
        .set({ status: 'released', updatedAt: new Date() })
        .where(eq(escrows.id, escrow.id));
    });

    // 3. Post Double-Entry Ledger: release escrow asset to tenant liability, clear platform owner rent liability
    await ledgerService.postEntry(
      `Escrow Release & Booking Completion for Reservation #${reservationId.substring(0, 8)}`,
      [
        // Debit owner liability (we clear what we owe the owner, as treasury transfers rent to owner)
        {
          accountPath: `liabilities:owners:${reservation.listing.ownerId}`,
          amount: reservation.subtotalUsdt,
          direction: 'debit',
        },
        // Credit Platform treasury (funds sent to owner)
        {
          accountPath: `assets:treasury`,
          amount: reservation.subtotalUsdt,
          direction: 'credit',
        },
        // Ledger entry to clear the Escrow Asset (cleared back to tenant)
        {
          accountPath: `liabilities:tenants:${tenantPublicKey}`,
          amount: reservation.securityDepositUsdt,
          direction: 'debit',
        },
        {
          accountPath: `assets:escrow:trustless:${escrow.id}`,
          amount: reservation.securityDepositUsdt,
          direction: 'credit',
        },
      ],
      'reservation',
      reservationId
    );

    revalidatePath('/admin');
    revalidatePath(`/reservations/${reservationId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Checkout settlement failed' };
  }
}

// Action to file a dispute
export async function fileDispute(reservationId: string, claimedAmount: string, reason: string) {
  try {
    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      with: {
        escrows: true,
      },
    });

    if (!reservation) throw new Error('Reservation not found');
    const escrow = reservation.escrows[0];
    if (!escrow) throw new Error('No active escrow found');

    const success = await trustlessProvider.disputeEscrow(escrow.trustlessEscrowId!, reason);
    if (!success) throw new Error('Could not open dispute on Trustless contract');

    // Create dispute in DB
    await db.transaction(async (tx) => {
      await tx
        .update(reservations)
        .set({ status: 'disputed' })
        .where(eq(reservations.id, reservationId));

      await tx
        .update(escrows)
        .set({ status: 'disputed', updatedAt: new Date() })
        .where(eq(escrows.id, escrow.id));

      await tx.insert(disputes).values({
        escrowId: escrow.id,
        reservationId: reservationId,
        claimedAmountUsdt: claimedAmount,
        reason,
        status: 'active',
      });
    });

    revalidatePath('/admin');
    revalidatePath(`/reservations/${reservationId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Dispute initiation failed' };
  }
}
