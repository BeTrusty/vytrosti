import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createReservationDispute } from '@/application/services/reservation-workflow';

export async function POST(request: NextRequest, ctx: RouteContext<'/api/reservations/[id]/dispute'>) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const claimedAmount = body && typeof body.claimedAmount === 'string' ? body.claimedAmount : '';
    const reason = body && typeof body.reason === 'string' ? body.reason : '';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Reservation id is required.' }, { status: 400 });
    }

    const result = await createReservationDispute(id, claimedAmount, reason);

    return NextResponse.json(
      {
        success: result.success,
        error: result.error,
      },
      { status: result.success ? 200 : (result.status ?? 500) }
    );
  } catch (error) {
    console.error('Reservation dispute route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reservation dispute failed.',
      },
      { status: 500 }
    );
  }
}
