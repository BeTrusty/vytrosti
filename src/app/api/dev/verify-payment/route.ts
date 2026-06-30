import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { paymentIntents } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { paymentPoller } from '@/application/services/poller';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : '';

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, paymentDetected: false, status: null, error: 'paymentIntentId is required.' },
        { status: 400 }
      );
    }

    const intentBefore = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
    });

    if (!intentBefore) {
      return NextResponse.json(
        { success: false, paymentDetected: false, status: null, error: 'Payment intent not found.' },
        { status: 404 }
      );
    }

    if (intentBefore.status === 'paid') {
      return NextResponse.json({
        success: true,
        paymentDetected: true,
        status: 'paid',
      });
    }

    await paymentPoller.pollPayments();

    const intentAfter = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
    });

    return NextResponse.json({
      success: true,
      paymentDetected: intentAfter?.status === 'paid',
      status: intentAfter?.status ?? null,
    });
  } catch (error) {
    console.error('Verify payment route failed:', error);
    return NextResponse.json(
      {
        success: false,
        paymentDetected: false,
        status: null,
        error: error instanceof Error ? error.message : 'Ledger scanning failed.',
      },
      { status: 500 }
    );
  }
}
