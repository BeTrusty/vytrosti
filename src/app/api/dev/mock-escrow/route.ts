import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { reservations, users } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth/server';
import { trustlessProvider } from '@/infrastructure/trustless/provider';
import { markReservationEscrowFunded } from '@/application/services/reservation-escrow';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    if (process.env.TRUSTLESS_MOCK === 'false') {
      return NextResponse.json(
        { success: false, error: 'Mock deposit endpoint is only available when TRUSTLESS_MOCK is active.' },
        { status: 400 }
      );
    }

    const sessionResponse = await auth.getSession();
    const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
    }

    const body = await request.json();
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';

    if (!reservationId) {
      return NextResponse.json({ success: false, error: 'reservationId is required.' }, { status: 400 });
    }

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      with: {
        tenant: true,
        listing: {
          with: {
            owner: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ success: false, error: 'Reservation not found.' }, { status: 404 });
    }

    const isAdminUser = session.user.role === 'admin';
    if (!isAdminUser) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
      });

      if (!currentUser || currentUser.id !== reservation.tenant.userId) {
        return NextResponse.json({ success: false, error: 'Reservation access denied.' }, { status: 403 });
      }
    }

    const mockEscrow = await trustlessProvider.createEscrow(
      reservation.id,
      reservation.tenant.stellarPublicKey,
      reservation.listing.owner.stellarPublicKey,
      reservation.securityDepositUsdt
    );

    const engagementId = mockEscrow.escrowId;
    const contractId = mockEscrow.contractAddress;

    const result = await markReservationEscrowFunded({
      reservationId,
      contractId,
      engagementId,
      amountUsdt: reservation.securityDepositUsdt,
    });

    revalidatePath(`/reservations/${reservationId}`);
    revalidatePath('/reservations');
    revalidatePath('/admin');

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Mock deposit funding failed.',
      },
      { status: 500 }
    );
  }
}
