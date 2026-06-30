import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { reservations, users } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth/server';
import { stellarProvider } from '@/infrastructure/stellar/provider';

export async function POST(request: Request) {
  try {
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

    const receiverPublicKey = reservation.listing.owner.stellarPublicKey;
    const platformPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY || '';

    if (!platformPublicKey) {
      return NextResponse.json(
        { success: false, error: 'STELLAR_TREASURY_PUBLIC_KEY is required for Trustless Work preflight.' },
        { status: 500 }
      );
    }

    const [receiverReadiness, platformReadiness] = await Promise.all([
      stellarProvider.getAssetReadiness(receiverPublicKey),
      stellarProvider.getAssetReadiness(platformPublicKey),
    ]);

    return NextResponse.json({
      success: true,
      readiness: {
        receiver: receiverReadiness,
        platformAddress: platformReadiness,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not validate the Trustless Work accounts.',
      },
      { status: 500 }
    );
  }
}
