import { NextResponse } from 'next/server';
import { paymentPoller } from '@/application/services/poller';

export async function GET(req: Request) {
  try {
    // 1. Secure check: validate CRON_SECRET if defined
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Execute Polling logic
    const results = await paymentPoller.pollPayments();

    return NextResponse.json({
      success: true,
      message: 'Stellar and Trustless ledger scanning execution finished successfully',
      data: results,
    });
  } catch (error) {
    console.error('Error running poll-payments cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
