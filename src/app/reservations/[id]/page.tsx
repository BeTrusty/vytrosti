import React from 'react';
import { db } from '@/infrastructure/db/client';
import { reservations, systemConfigs, users } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ReservationDetails } from '@/presentation/components/ReservationDetails';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/infrastructure/auth/server';
import { redirect } from 'next/navigation';

interface ReservationPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0; // Dynamic rendering

function safeIsoString(value: Date | null | undefined) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function safeText(value: string | null | undefined) {
  return typeof value === 'string' ? value : '';
}

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { id } = await params;
  const sessionResponse = await auth.getSession();
  const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

  if (!session) {
    redirect(`/login?callbackUrl=/reservations/${id}`);
  }

  const isAdminUser = session.user.role === 'admin';
  const currentUser = isAdminUser
    ? null
    : await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
        with: {
          owner: true,
          tenant: true,
        },
      });

  let res = null;

  try {
    res = await db.query.reservations.findFirst({
      where: eq(reservations.id, id),
      with: {
        listing: {
          with: {
            owner: {
              with: {
                user: true,
              },
            },
          },
        },
        tenant: {
          with: {
            user: true,
          },
        },
        paymentIntents: {
          with: {
            wallet: true,
          },
        },
        escrows: {
          with: {
            disputes: {
              orderBy: (dispute, { desc }) => [desc(dispute.createdAt)],
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Failed to load reservation from database:', error);
  }

  if (!res) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="text-2xl font-bold">Reservation Not Found</h2>
        <p className="text-slate-400 mt-2">Could not find booking records for ID #{id.substring(0, 8)}.</p>
        <Link href="/" className="text-indigo-400 font-semibold inline-flex items-center gap-1.5 mt-6 hover:underline">
          <ArrowLeft size={16} /> Back to explore
        </Link>
      </div>
    );
  }

  if (!isAdminUser && (!currentUser || res.tenant?.userId !== currentUser.id)) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="text-2xl font-bold text-[#131b2e]">Reservation Not Available</h2>
        <p className="text-slate-400 mt-2">
          This reservation does not belong to the signed-in guest account.
        </p>
        <Link href="/reservations" className="text-[#064e3b] font-semibold inline-flex items-center gap-1.5 mt-6 hover:underline">
          <ArrowLeft size={16} /> Back to my reservations
        </Link>
      </div>
    );
  }

  let hasSecretKey = false;
  try {
    if (res.tenant?.stellarPublicKey) {
      const secretConfig = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, `test_user_secret_${res.tenant.stellarPublicKey}`),
      });
      hasSecretKey = !!secretConfig?.value;
    }
  } catch (err) {
    console.error('Failed to look up guest secret key config:', err);
  }

  let disputeWindowHours = 72;
  try {
    const disputeWindowConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'dispute_window_hours'),
    });
    if (disputeWindowConfig) {
      const parsedWindow = parseFloat(disputeWindowConfig.value);
      if (Number.isFinite(parsedWindow) && parsedWindow > 0) {
        disputeWindowHours = parsedWindow;
      }
    }
  } catch (err) {
    console.error('Failed to look up dispute window config:', err);
  }

  const isTenant = currentUser ? res.tenantId === currentUser.tenant?.id : false;
  const isOwner = currentUser ? res.listing?.ownerId === currentUser.owner?.id : false;
  const isAdmin = isAdminUser;

  // Format to JSON serializable fields (handling dates & decimal values)
  const formattedRes = {
    id: res.id,
    checkIn: safeIsoString(res.checkIn) ?? new Date(0).toISOString(),
    checkOut: safeIsoString(res.checkOut) ?? new Date(0).toISOString(),
    subtotalUsdt: safeText(res.subtotalUsdt),
    securityDepositUsdt: safeText(res.securityDepositUsdt),
    platformFeeUsdt: safeText(res.platformFeeUsdt),
    status: safeText(res.status),
    checkoutClaimedAt: safeIsoString(res.checkoutClaimedAt),
    ownerPublicKey: safeText(res.listing?.owner?.stellarPublicKey),
    platformPublicKey: safeText(process.env.STELLAR_TREASURY_PUBLIC_KEY),
    stellarExplorerBaseUrl:
      process.env.STELLAR_NETWORK === 'public'
        ? 'https://stellar.expert/explorer/public/account/'
        : 'https://stellar.expert/explorer/testnet/account/',
    usdcIssuerPublicKey: safeText(process.env.STELLAR_USDC_ASSET_ISSUER),
    hasTrustlessApiKey: Boolean(process.env.NEXT_PUBLIC_TRUSTLESS_API_KEY || process.env.TRUSTLESS_API_KEY),
    listing: {
      title: safeText(res.listing?.title),
      city: safeText(res.listing?.city),
      country: safeText(res.listing?.country),
    },
    tenantName: safeText(res.tenant?.user?.name) || 'Guest user',
    ownerName: safeText(res.listing?.owner?.user?.name) || 'Owner user',
    tenantPublicKey: safeText(res.tenant?.stellarPublicKey),
    hasSecretKey,
    paymentIntents: res.paymentIntents.flatMap((i) => {
      if (!i.wallet) {
        return [];
      }

      return [{
      id: i.id,
      amountUsdt:
        res.status === 'pending_payment' && i.status === 'pending'
          ? (parseFloat(res.subtotalUsdt) + parseFloat(res.platformFeeUsdt)).toFixed(4)
          : safeText(i.amountUsdt),
      status: safeText(i.status),
      expiresAt: safeIsoString(i.expiresAt) ?? new Date(0).toISOString(),
      txHash: i.txHash ?? null,
      wallet: {
        id: i.wallet.id,
        publicKey: safeText(i.wallet.publicKey),
      },
    }];
    }),
    escrows: res.escrows.map((e) => ({
      id: e.id,
      contractAddress: e.contractAddress ?? null,
      amountUsdt: safeText(e.amountUsdt),
      status: safeText(e.status),
      trustlessEscrowId: e.trustlessEscrowId ?? null,
      latestDispute: e.disputes[0]
        ? {
            status: safeText(e.disputes[0].status),
            resolutionDetails: safeText(e.disputes[0].resolutionDetails),
          }
        : null,
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-6">
      <div>
        <Link href="/reservations" className="text-slate-400 hover:text-[#131b2e] transition-colors inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back to my reservations
        </Link>
      </div>
      <ReservationDetails
        reservation={formattedRes}
        isMockMode={process.env.STELLAR_MOCK !== 'false'}
        isTrustlessMockMode={process.env.TRUSTLESS_MOCK !== 'false'}
        roleContext={{ isTenant, isOwner, isAdmin }}
        disputeWindowHours={disputeWindowHours}
      />
    </div>
  );
}
