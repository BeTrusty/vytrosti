import React from 'react';
import { db } from '@/infrastructure/db/client';
import { reservations } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ReservationDetails } from '@/presentation/components/ReservationDetails';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface ReservationPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0; // Dynamic rendering

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { id } = await params;

  let res = null;

  try {
    res = await db.query.reservations.findFirst({
      where: eq(reservations.id, id),
      with: {
        listing: true,
        paymentIntents: {
          with: {
            wallet: true,
          },
        },
        escrows: true,
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

  // Format to JSON serializable fields (handling dates & decimal values)
  const formattedRes = {
    id: res.id,
    checkIn: res.checkIn.toISOString(),
    checkOut: res.checkOut.toISOString(),
    subtotalUsdt: res.subtotalUsdt,
    securityDepositUsdt: res.securityDepositUsdt,
    platformFeeUsdt: res.platformFeeUsdt,
    status: res.status,
    listing: {
      title: res.listing.title,
      city: res.listing.city,
      country: res.listing.country,
    },
    paymentIntents: res.paymentIntents.map((i) => ({
      id: i.id,
      amountUsdt: i.amountUsdt,
      status: i.status,
      expiresAt: i.expiresAt.toISOString(),
      txHash: i.txHash,
      wallet: {
        id: i.wallet.id,
        publicKey: i.wallet.publicKey,
      },
    })),
    escrows: res.escrows.map((e) => ({
      id: e.id,
      contractAddress: e.contractAddress,
      amountUsdt: e.amountUsdt,
      status: e.status,
      trustlessEscrowId: e.trustlessEscrowId,
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-6">
      <div>
        <Link href="/" className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Back to Search
        </Link>
      </div>
      <ReservationDetails reservation={formattedRes} />
    </div>
  );
}
