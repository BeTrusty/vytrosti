import { NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';
import { db } from '@/infrastructure/db/client';
import { reservations, systemConfigs, users } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth/server';

export async function POST(request: Request) {
  try {
    const sessionResponse = await auth.getSession();
    const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
    }

    const body = await request.json();
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId : '';
    const unsignedTransaction = typeof body.unsignedTransaction === 'string' ? body.unsignedTransaction : '';

    if (!reservationId || !unsignedTransaction) {
      return NextResponse.json(
        { success: false, error: 'reservationId and unsignedTransaction are required.' },
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

    const secretConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, `test_user_secret_${reservation.tenant.stellarPublicKey}`),
    });

    if (!secretConfig?.value) {
      return NextResponse.json(
        {
          success: false,
          error: `Guest secret key for account ${reservation.tenant.stellarPublicKey.substring(0, 8)}... is not configured.`,
        },
        { status: 400 }
      );
    }

    const networkPassphrase =
      process.env.STELLAR_NETWORK === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    const envelope = StellarSdk.TransactionBuilder.fromXDR(unsignedTransaction, networkPassphrase);
    envelope.sign(StellarSdk.Keypair.fromSecret(secretConfig.value));

    return NextResponse.json({
      success: true,
      signedXdr: envelope.toXDR(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not sign the Trustless Work envelope.',
      },
      { status: 500 }
    );
  }
}
