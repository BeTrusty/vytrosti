import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Chip, Button } from '@heroui/react';
import { CalendarDays, ChevronRight, MapPin, ReceiptText } from 'lucide-react';
import { auth } from '@/infrastructure/auth/server';
import { db } from '@/infrastructure/db/client';
import { reservations, users, tenants } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

export const revalidate = 0;

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function renderStatusChip(status: string) {
  switch (status) {
    case 'pending_payment':
      return <Chip color="warning" variant="soft">Awaiting Payment</Chip>;
    case 'paid':
      return <Chip color="success" variant="soft">First Payment Confirmed</Chip>;
    case 'escrowed':
      return <Chip color="accent" variant="soft">Deposit Secured</Chip>;
    case 'active':
      return <Chip color="accent" variant="soft">Stay Active</Chip>;
    case 'completed':
      return <Chip color="success" variant="primary">Completed</Chip>;
    case 'cancelled':
      return <Chip color="danger" variant="soft">Cancelled</Chip>;
    case 'disputed':
      return <Chip color="danger" variant="primary">Disputed</Chip>;
    default:
      return <Chip>{status}</Chip>;
  }
}

export default async function ReservationsPage() {
  const sessionResponse = await auth.getSession();
  const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;

  if (!session) {
    redirect('/login?callbackUrl=/reservations');
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
  });

  const tenantProfile = currentUser
    ? await db.query.tenants.findFirst({
        where: eq(tenants.userId, currentUser.id),
      })
    : null;

  const reservationList = tenantProfile
    ? await db.query.reservations.findMany({
        where: eq(reservations.tenantId, tenantProfile.id),
        orderBy: (reservation, { desc }) => [desc(reservation.createdAt)],
        with: {
          listing: true,
        },
      })
    : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#eaedff] bg-[#f2f3ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#064e3b]">
          <ReceiptText size={12} />
          Guest Portal
        </span>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#131b2e]">
              My Reservations
            </h1>
            <p className="max-w-2xl text-sm md:text-base text-slate-500">
              Keep every stay reference in one place, with payment and deposit progress visible at a glance.
            </p>
          </div>
          <Link href="/">
            <Button className="bg-[#003527] text-white font-semibold rounded-xl">
              Explore More Stays
            </Button>
          </Link>
        </div>
      </section>

      {reservationList.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-[#d6ddff] bg-white p-8">
          <Card.Content className="p-0 flex flex-col gap-3 text-center items-center">
            <h2 className="text-xl font-bold text-[#131b2e]">No reservations yet</h2>
            <p className="max-w-lg text-sm text-slate-500">
              Once you book a stay, it will appear here with its reference, payment progress, and next steps.
            </p>
            <Link href="/">
              <Button className="bg-[#064e3b] text-white font-semibold rounded-xl">
                Browse Listings
              </Button>
            </Link>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {reservationList.map((reservation) => {
            const firstPaymentTotal = (
              parseFloat(reservation.subtotalUsdt) + parseFloat(reservation.platformFeeUsdt)
            ).toFixed(2);

            return (
              <Card key={reservation.id} className="ambient-lift rounded-3xl border-none bg-white p-6">
                <Card.Content className="p-0 flex flex-col gap-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                        Booking Reference #{reservation.id.slice(0, 8)}
                      </span>
                      <h2 className="text-2xl font-bold text-[#131b2e]">
                        {reservation.listing.title}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <MapPin size={14} />
                        <span>{reservation.listing.city}, {reservation.listing.country}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      {renderStatusChip(reservation.status)}
                      <span className="text-xs text-slate-400">
                        Created {formatDate(reservation.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-[#eaedff] bg-[#f8faff] p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Check-In</span>
                      <p className="mt-2 font-bold text-[#131b2e]">{formatDate(reservation.checkIn)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaedff] bg-[#f8faff] p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Check-Out</span>
                      <p className="mt-2 font-bold text-[#131b2e]">{formatDate(reservation.checkOut)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaedff] bg-[#f8faff] p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">First Payment</span>
                      <p className="mt-2 font-bold text-[#064e3b]">{firstPaymentTotal} USDC</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaedff] bg-[#f8faff] p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Security Deposit</span>
                      <p className="mt-2 font-bold text-[#131b2e]">
                        {parseFloat(reservation.securityDepositUsdt).toFixed(2)} USDC
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <CalendarDays size={15} />
                      <span>Open the full reservation page to continue payment or review deposit protection.</span>
                    </div>
                    <Link href={`/reservations/${reservation.id}`}>
                      <Button className="bg-[#eaedff] text-[#064e3b] font-semibold rounded-xl">
                        View Reservation
                        <ChevronRight size={16} />
                      </Button>
                    </Link>
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
