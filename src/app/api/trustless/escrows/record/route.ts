import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { reservations, users } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth/server';
import {
  markReservationEscrowFunded,
  recordInitializedReservationEscrow,
} from '@/application/services/reservation-escrow';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const sessionResponse = await auth.getSession();
    const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
    }

    const body = await request.json();
    const stage = body.stage === 'initialized' || body.stage === 'funded' ? body.stage : null;
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';
    const contractId = typeof body.contractId === 'string' ? body.contractId : '';
    const engagementId = typeof body.engagementId === 'string' ? body.engagementId : '';
    const amountUsdt = typeof body.amountUsdt === 'string' ? body.amountUsdt : '';

    if (!stage || !reservationId || !contractId || !engagementId || !amountUsdt) {
      return NextResponse.json(
        { success: false, error: 'stage, reservationId, contractId, engagementId, and amountUsdt are required.' },
        { status: 400 }
      );
    }

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId),
      with: {
        tenant: true,
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

    const result =
      stage === 'initialized'
        ? await recordInitializedReservationEscrow({
            reservationId,
            contractId,
            engagementId,
            amountUsdt,
          })
        : await markReservationEscrowFunded({
            reservationId,
            contractId,
            engagementId,
            amountUsdt,
          });

    revalidatePath(`/reservations/${reservationId}`);
    revalidatePath('/reservations');
    revalidatePath('/admin');

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not persist the Trustless Work escrow.',
      },
      { status: 500 }
    );
  }
}
