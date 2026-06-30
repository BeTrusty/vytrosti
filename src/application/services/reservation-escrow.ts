import { db } from '@/infrastructure/db/client';
import { escrows, reservations } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ledgerService } from './ledger';

interface EscrowRecordInput {
  reservationId: string;
  contractId: string;
  engagementId: string;
  amountUsdt: string;
}

const ESCROW_AMOUNT_TOLERANCE = 0.0001;

function assertMatchingAmount(expectedAmount: string, actualAmount: string) {
  if (Math.abs(parseFloat(expectedAmount) - parseFloat(actualAmount)) > ESCROW_AMOUNT_TOLERANCE) {
    throw new Error('Deposit amount does not match the reservation security deposit.');
  }
}

export async function recordInitializedReservationEscrow({
  reservationId,
  contractId,
  engagementId,
  amountUsdt,
}: EscrowRecordInput) {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: {
      escrows: true,
    },
  });

  if (!reservation) {
    throw new Error('Reservation not found.');
  }

  if (reservation.status !== 'paid' && reservation.status !== 'escrowed') {
    throw new Error('Reservation is not ready for deposit initialization.');
  }

  assertMatchingAmount(reservation.securityDepositUsdt, amountUsdt);

  const existingEscrow = reservation.escrows[0];

  if (existingEscrow) {
    await db
      .update(escrows)
      .set({
        contractAddress: contractId,
        trustlessEscrowId: engagementId,
        amountUsdt,
        updatedAt: new Date(),
      })
      .where(eq(escrows.id, existingEscrow.id));

    return {
      escrowId: existingEscrow.id,
      status: existingEscrow.status,
      contractId,
      engagementId,
    };
  }

  const [createdEscrow] = await db
    .insert(escrows)
    .values({
      reservationId,
      contractAddress: contractId,
      trustlessEscrowId: engagementId,
      amountUsdt,
      status: 'pending',
    })
    .returning();

  return {
    escrowId: createdEscrow.id,
    status: createdEscrow.status,
    contractId,
    engagementId,
  };
}

export async function markReservationEscrowFunded({
  reservationId,
  contractId,
  engagementId,
  amountUsdt,
}: EscrowRecordInput) {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    with: {
      tenant: true,
      escrows: true,
    },
  });

  if (!reservation) {
    throw new Error('Reservation not found.');
  }

  if (reservation.status !== 'paid' && reservation.status !== 'escrowed') {
    throw new Error('Reservation is not ready for deposit funding.');
  }

  assertMatchingAmount(reservation.securityDepositUsdt, amountUsdt);

  const existingEscrow = reservation.escrows[0];

  if (reservation.status === 'escrowed' && existingEscrow?.status === 'funded') {
    return {
      escrowId: existingEscrow.id,
      alreadyFunded: true,
    };
  }

  const fundedEscrow = await db.transaction(async (tx) => {
    let escrowRecordId = existingEscrow?.id;

    if (existingEscrow) {
      await tx
        .update(escrows)
        .set({
          contractAddress: contractId,
          trustlessEscrowId: engagementId,
          amountUsdt,
          status: 'funded',
          updatedAt: new Date(),
        })
        .where(eq(escrows.id, existingEscrow.id));
    } else {
      const [createdEscrow] = await tx
        .insert(escrows)
        .values({
          reservationId,
          contractAddress: contractId,
          trustlessEscrowId: engagementId,
          amountUsdt,
          status: 'funded',
        })
        .returning();

      escrowRecordId = createdEscrow.id;
    }

    await tx
      .update(reservations)
      .set({ status: 'escrowed' })
      .where(eq(reservations.id, reservationId));

    return {
      escrowId: escrowRecordId!,
    };
  });

  await ledgerService.postEntry(
    `Deposit Secured for Reservation #${reservationId.substring(0, 8)}`,
    [
      {
        accountPath: `assets:escrow:trustless:${contractId}`,
        amount: amountUsdt,
        direction: 'debit',
      },
      {
        accountPath: `liabilities:tenants:${reservation.tenantId}`,
        amount: amountUsdt,
        direction: 'credit',
      },
    ],
    'reservation',
    reservationId
  );

  return {
    escrowId: fundedEscrow.escrowId,
    alreadyFunded: false,
  };
}
