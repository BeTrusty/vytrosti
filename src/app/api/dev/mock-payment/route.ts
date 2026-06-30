import { NextResponse } from 'next/server';
import { stellarProvider } from '@/infrastructure/stellar/provider';

export async function POST(request: Request) {
  try {
    if (process.env.STELLAR_MOCK === 'false') {
      return NextResponse.json(
        { success: false, error: 'Mock payment endpoint is only available when STELLAR_MOCK is active.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const walletId = typeof body.walletId === 'string' ? body.walletId : '';
    const guestPublicKey = typeof body.guestPublicKey === 'string' ? body.guestPublicKey : '';
    const amountUsdt = typeof body.amountUsdt === 'string' ? body.amountUsdt : '';

    if (!walletId || !guestPublicKey || !amountUsdt) {
      return NextResponse.json(
        { success: false, error: 'walletId, guestPublicKey, and amountUsdt are required.' },
        { status: 400 }
      );
    }

    const txHash = await stellarProvider.simulatePaymentDeposit(walletId, guestPublicKey, amountUsdt);

    return NextResponse.json({
      success: true,
      txHash,
    });
  } catch (error) {
    console.error('Mock payment route failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Mock payment failed.' },
      { status: 500 }
    );
  }
}
