import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requestReservationCheckout, settleReservationCheckout } from '@/application/services/reservation-workflow';

export async function POST(request: NextRequest, ctx: RouteContext<'/api/reservations/[id]/checkout'>) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const action = body && typeof body.action === 'string' ? body.action : '';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Reservation id is required.' }, { status: 400 });
    }

    if (action !== 'request' && action !== 'settle') {
      return NextResponse.json({ success: false, error: 'Action must be "request" or "settle".' }, { status: 400 });
    }

    const result =
      action === 'request'
        ? await requestReservationCheckout(id)
        : await settleReservationCheckout(id);

    return NextResponse.json(
      {
        success: result.success,
        error: result.error,
      },
      { status: result.success ? 200 : (result.status ?? 500) }
    );
  } catch (error) {
    console.error('Reservation checkout route failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reservation checkout failed.',
      },
      { status: 500 }
    );
  }
}
