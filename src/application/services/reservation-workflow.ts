import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth/server';
import { db } from '@/infrastructure/db/client';
import { disputes, escrows, reservations, systemConfigs, users } from '@/infrastructure/db/schema';
import { ledgerService } from './ledger';
import { trustlessProvider } from '@/infrastructure/trustless/provider';

type WorkflowResult = {
  success: boolean;
  error?: string;
  status?: number;
};

type ActorContext = {
  isAdmin: boolean;
  ownerId: string | null;
  tenantId: string | null;
};

async function getActorContext(): Promise<ActorContext | null> {
  const sessionResponse = await auth.getSession();
  const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

  if (!session) {
    return null;
  }

  if (session.user.role === 'admin') {
    return {
      isAdmin: true,
      ownerId: null,
      tenantId: null,
    };
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    with: {
      owner: true,
      tenant: true,
    },
  });

  return {
    isAdmin: false,
    ownerId: currentUser?.owner?.id ?? null,
    tenantId: currentUser?.tenant?.id ?? null,
  };
}

async function getDisputeWindowHours() {
  const disputeWindowConfig = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, 'dispute_window_hours'),
  });
  const parsedValue = parseFloat(disputeWindowConfig?.value ?? '72');
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 72;
}

function isWindowExpired(checkoutClaimedAt: Date | null, disputeWindowHours: number) {
  if (!checkoutClaimedAt) {
    return false;
  }

  return Date.now() >= checkoutClaimedAt.getTime() + disputeWindowHours * 60 * 60 * 1000;
}

function revalidateReservationViews(reservationId: string) {
  revalidatePath('/admin');
  revalidatePath(`/reservations/${reservationId}`);
}

export async function requestReservationCheckout(reservationId: string): Promise<WorkflowResult> {
  try {
    const actor = await getActorContext();
    if (!actor) {
      return { success: false, error: 'You must be signed in to request checkout.', status: 401 };
    }

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
    });

    if (!reservation) {
      return { success: false, error: 'Reservation not found.', status: 404 };
    }

    if (!actor.isAdmin && actor.tenantId !== reservation.tenantId) {
      return { success: false, error: 'Only the guest can request checkout for this reservation.', status: 403 };
    }

    if (reservation.status !== 'escrowed' && reservation.status !== 'active') {
      return { success: false, error: 'Reservation is not in a valid state for checkout.', status: 400 };
    }

    await db
      .update(reservations)
      .set({
        status: 'checking_out',
        checkoutClaimedAt: new Date(),
      })
      .where(eq(reservations.id, reservationId));

    revalidateReservationViews(reservationId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request checkout.',
      status: 500,
    };
  }
}

export async function settleReservationCheckout(reservationId: string): Promise<WorkflowResult> {
  try {
    const actor = await getActorContext();
    if (!actor) {
      return { success: false, error: 'You must be signed in to settle checkout.', status: 401 };
    }

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

    if (!reservation) {
      return { success: false, error: 'Reservation not found.', status: 404 };
    }

    if (!reservation.listing) {
      return { success: false, error: 'Reservation listing details are unavailable.', status: 500 };
    }

    if (reservation.status !== 'checking_out') {
      return { success: false, error: 'Reservation is not currently in checkout review.', status: 400 };
    }

    const disputeWindowHours = await getDisputeWindowHours();
    const windowExpired = isWindowExpired(reservation.checkoutClaimedAt ?? null, disputeWindowHours);

    if (!actor.isAdmin) {
      const canOwnerSettle = !windowExpired && actor.ownerId === reservation.listing.ownerId;
      const canTenantClaim = windowExpired && actor.tenantId === reservation.tenantId;

      if (!canOwnerSettle && !canTenantClaim) {
        return {
          success: false,
          error: windowExpired
            ? 'Only the guest can claim the deposit after the review window expires.'
            : 'Only the host can approve checkout during the review window.',
          status: 403,
        };
      }
    }

    const escrow = reservation.escrows[0];
    if (!escrow) {
      return { success: false, error: 'Security deposit escrow contract not found.', status: 404 };
    }
    if (!escrow.trustlessEscrowId) {
      return { success: false, error: 'Escrow reference is missing for this reservation.', status: 500 };
    }

    const escrowAccountPathSuffix = escrow.contractAddress || escrow.id;
    const tenantLedgerId = reservation.tenantId;

    const releaseSuccess = await trustlessProvider.releaseEscrow(escrow.trustlessEscrowId);
    if (!releaseSuccess) {
      return { success: false, error: 'Failed to release escrow via Trustless Work.', status: 502 };
    }

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

    await ledgerService.postEntry(
      `Escrow Release & Booking Completion for Reservation #${reservationId.substring(0, 8)}`,
      [
        {
          accountPath: `liabilities:owners:${reservation.listing.ownerId}`,
          amount: reservation.subtotalUsdt,
          direction: 'debit',
        },
        {
          accountPath: 'assets:treasury',
          amount: reservation.subtotalUsdt,
          direction: 'credit',
        },
        {
          accountPath: `liabilities:tenants:${tenantLedgerId}`,
          amount: reservation.securityDepositUsdt,
          direction: 'debit',
        },
        {
          accountPath: `assets:escrow:trustless:${escrowAccountPathSuffix}`,
          amount: reservation.securityDepositUsdt,
          direction: 'credit',
        },
      ],
      'reservation',
      reservationId
    );

    revalidateReservationViews(reservationId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Checkout settlement failed.',
      status: 500,
    };
  }
}

export async function createReservationDispute(
  reservationId: string,
  claimedAmount: string,
  reason: string
): Promise<WorkflowResult> {
  try {
    const actor = await getActorContext();
    if (!actor) {
      return { success: false, error: 'You must be signed in to open a dispute.', status: 401 };
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return { success: false, error: 'A dispute reason is required.', status: 400 };
    }

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

    if (!reservation) {
      return { success: false, error: 'Reservation not found.', status: 404 };
    }

    if (!reservation.listing) {
      return { success: false, error: 'Reservation listing details are unavailable.', status: 500 };
    }

    if (!actor.isAdmin && actor.ownerId !== reservation.listing.ownerId) {
      return { success: false, error: 'Only the host can open a dispute for this reservation.', status: 403 };
    }

    if (
      reservation.status !== 'escrowed' &&
      reservation.status !== 'active' &&
      reservation.status !== 'checking_out'
    ) {
      return { success: false, error: 'Reservation is not in a valid state for dispute review.', status: 400 };
    }

    if (reservation.status === 'checking_out') {
      const disputeWindowHours = await getDisputeWindowHours();
      if (isWindowExpired(reservation.checkoutClaimedAt ?? null, disputeWindowHours)) {
        return { success: false, error: 'The review window has expired and the deposit can no longer be disputed here.', status: 400 };
      }
    }

    const parsedClaim = parseFloat(claimedAmount);
    const maxClaim = parseFloat(reservation.securityDepositUsdt);
    if (!Number.isFinite(parsedClaim) || parsedClaim <= 0) {
      return { success: false, error: 'Claim amount must be greater than zero.', status: 400 };
    }
    if (parsedClaim > maxClaim) {
      return { success: false, error: 'Claim amount cannot exceed the protected deposit.', status: 400 };
    }

    const escrow = reservation.escrows[0];
    if (!escrow) {
      return { success: false, error: 'No active escrow found.', status: 404 };
    }
    if (!escrow.trustlessEscrowId) {
      return { success: false, error: 'Escrow reference is missing for this reservation.', status: 500 };
    }

    const disputeOpened = await trustlessProvider.disputeEscrow(escrow.trustlessEscrowId, normalizedReason);
    if (!disputeOpened) {
      return { success: false, error: 'Could not open dispute on the Trustless Work contract.', status: 502 };
    }

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
        reservationId,
        claimedAmountUsdt: parsedClaim.toFixed(4),
        reason: normalizedReason,
        status: 'active',
      });
    });

    revalidateReservationViews(reservationId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Dispute initiation failed.',
      status: 500,
    };
  }
}
