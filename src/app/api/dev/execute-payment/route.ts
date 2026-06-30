import { NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';
import { db } from '@/infrastructure/db/client';
import { paymentIntents, systemConfigs } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { stellarProvider } from '@/infrastructure/stellar/provider';
import { walletPoolService } from '@/application/services/wallet-pool';

async function ensureReservationWalletReady(walletId: string, publicKey: string) {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const usdcCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
  const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER || '';

  if (!usdcIssuer) {
    throw new Error('STELLAR_USDC_ASSET_ISSUER is required to prepare the reservation account for testnet payments.');
  }

  try {
    await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  } catch {
    // Ignore Friendbot failures here. The account may already be active.
  }

  const account = await server.loadAccount(publicKey);
  const hasTrustline = account.balances.some(
    (balance) =>
      balance.asset_type !== 'native' &&
      'asset_code' in balance &&
      balance.asset_code === usdcCode &&
      'asset_issuer' in balance &&
      balance.asset_issuer === usdcIssuer
  );

  if (!hasTrustline) {
    const walletSecret = await walletPoolService.getWalletSecret(walletId);
    await stellarProvider.establishUsdcTrustline(walletSecret);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : '';

    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: 'paymentIntentId is required.' },
        { status: 400 }
      );
    }

    const intent = await db.query.paymentIntents.findFirst({
      where: eq(paymentIntents.id, paymentIntentId),
      with: {
        reservation: {
          with: {
            tenant: true,
          },
        },
        wallet: true,
      },
    });

    if (!intent) {
      return NextResponse.json(
        { success: false, error: 'Payment intent not found.' },
        { status: 404 }
      );
    }

    const tenantPublicKey = intent.reservation.tenant.stellarPublicKey;
    const secretConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, `test_user_secret_${tenantPublicKey}`),
    });

    let activeSecretKey = secretConfig?.value;
    let directTreasuryFallback = false;

    if (!activeSecretKey) {
      activeSecretKey = process.env.STELLAR_TREASURY_SECRET_KEY;
      directTreasuryFallback = true;
      if (!activeSecretKey) {
        return NextResponse.json(
          {
            success: false,
            error: `Neither guest secret key nor platform treasury secret key found in system configuration.`,
          },
          { status: 400 }
        );
      }
    }

    await ensureReservationWalletReady(intent.walletId, intent.wallet.publicKey);

    let txHash: string;

    try {
      txHash = await stellarProvider.sendUsdc(activeSecretKey, intent.wallet.publicKey, intent.amountUsdt);
    } catch (error) {
      if (directTreasuryFallback) {
        throw error;
      }

      const horizonError = error as {
        response?: {
          type?: string;
          status?: number;
        };
      };

      const isMissingTestnetAccount =
        horizonError?.response?.status === 404 ||
        horizonError?.response?.type === 'https://stellar.org/horizon-errors/not_found';

      if (!isMissingTestnetAccount) {
        throw error;
      }

      const treasurySecretKey = process.env.STELLAR_TREASURY_SECRET_KEY;
      if (!treasurySecretKey) {
        throw new Error(
          'Guest testnet account was not found in Horizon and STELLAR_TREASURY_SECRET_KEY is missing, so the dev fallback cannot submit a real testnet payment.'
        );
      }

      console.warn(
        'Execute payment route falling back to a treasury-signed real testnet payment because the guest testnet account was not found in Horizon.'
      );

      txHash = await stellarProvider.sendUsdc(
        treasurySecretKey,
        intent.wallet.publicKey,
        intent.amountUsdt
      );
    }

    return NextResponse.json({
      success: true,
      txHash,
    });
  } catch (error) {
    console.error('Execute payment route failed:', error);
    const horizonError = error as {
      response?: {
        data?: {
          detail?: string;
          extras?: {
            result_codes?: unknown;
          };
        };
      };
    };
    const detail = horizonError.response?.data?.detail;
    const resultCodes = horizonError.response?.data?.extras?.result_codes;
    return NextResponse.json(
      {
        success: false,
        error:
          detail && resultCodes
            ? `${detail} Codes: ${JSON.stringify(resultCodes)}`
            : error instanceof Error
              ? error.message
              : 'Payment execution failed.',
      },
      { status: 500 }
    );
  }
}
