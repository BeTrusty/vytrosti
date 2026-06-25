import React from 'react';
import { db } from '@/infrastructure/db/client';
import { AdminDashboard } from '@/presentation/components/AdminDashboard';
import { ledgerService } from '@/application/services/ledger';
import { auth } from '@/infrastructure/auth/server';
import { redirect } from 'next/navigation';

export const revalidate = 0; // Dynamic rendering

export default async function AdminPage() {
  const sessionResponse = await auth.getSession();
  const session = sessionResponse && 'data' in sessionResponse ? sessionResponse.data : null;
  if (!session || session.user.role !== 'admin') {
    redirect('/login?callbackUrl=/admin');
  }


  let listingsCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listingsList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reservationsList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let walletsList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let disputesList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledgerBalances: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledgerJournal: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usersList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ownersList: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenantsList: any[] = [];

  try {
    // 1. Get Listings
    listingsList = await db.query.listings.findMany();
    listingsCount = listingsList.length;

    // 2. Get Reservations list with listing relationship
    reservationsList = await db.query.reservations.findMany({
      orderBy: (res, { desc }) => [desc(res.createdAt)],
      with: {
        listing: true,
      },
    });

    // 3. Get Wallet Pool list
    walletsList = await db.query.wallets.findMany();

    // 4. Get Disputes list
    disputesList = await db.query.disputes.findMany({
      orderBy: (disp, { desc }) => [desc(disp.createdAt)],
    });

    // 5. Get Ledger Accounts & Balances
    const rawBalances = await ledgerService.getAccountBalances();
    const rawAccounts = await db.query.ledgerAccounts.findMany();

    ledgerBalances = rawAccounts.map(acc => {
      const balObj = rawBalances.find(b => b.accountPath === acc.id);
      return {
        accountPath: acc.id,
        balance: balObj ? balObj.balance : '0.0000',
      };
    });

    // 6. Get Ledger Entries (Journal) with lines
    ledgerJournal = await ledgerService.getJournalEntries();

    // 7. Get Users
    usersList = await db.query.users.findMany({
      orderBy: (u, { desc }) => [desc(u.createdAt)],
      with: {
        owner: true,
        tenant: true,
      },
    });

    // 8. Get Owners
    ownersList = await db.query.owners.findMany({
      with: {
        user: true,
        listings: {
          with: {
            reservations: true
          }
        }
      }
    });

    // 9. Get Tenants
    tenantsList = await db.query.tenants.findMany({
      with: {
        user: true,
        reservations: {
          with: {
            listing: true
          }
        }
      }
    });
  } catch (error) {
    console.warn('Failed to load DB stats in AdminPage, returning empty datasets:', error);
  }

  // Format objects to plain JSON serializable formats
  const initialData = {
    listingsCount,
    listings: listingsList.map((l) => ({
      id: l.id,
      title: l.title,
      pricePerNightUsdt: l.pricePerNightUsdt,
      securityDepositUsdt: l.securityDepositUsdt,
      city: l.city,
      country: l.country,
    })),
    reservations: reservationsList.map((r) => ({
      id: r.id,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      subtotalUsdt: r.subtotalUsdt,
      securityDepositUsdt: r.securityDepositUsdt,
      platformFeeUsdt: r.platformFeeUsdt,
      status: r.status,
      listing: {
        title: r.listing.title,
      },
    })),
    wallets: walletsList.map((w) => ({
      id: w.id,
      publicKey: w.publicKey,
      status: w.status,
      lastHorizonCursor: w.lastHorizonCursor,
      lastPolledAt: w.lastPolledAt?.toISOString() || null,
    })),
    disputes: disputesList.map((d) => ({
      id: d.id,
      reservationId: d.reservationId,
      claimedAmountUsdt: d.claimedAmountUsdt,
      reason: d.reason,
      status: d.status,
      resolutionDetails: d.resolutionDetails,
    })),
    ledgerAccounts: ledgerBalances,
    ledgerEntries: ledgerJournal.map((e) => ({
      id: e.id,
      description: e.description,
      referenceId: e.referenceId,
      postedAt: e.postedAt.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines: e.lines.map((l: any) => ({
        id: l.id,
        accountPath: l.accountPath,
        amount: l.amount,
        direction: l.direction,
      })),
    })),
    users: usersList.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      ownerId: u.owner?.id || null,
      tenantId: u.tenant?.id || null,
    })),
    owners: ownersList.map((o) => ({
      id: o.id,
      stellarPublicKey: o.stellarPublicKey,
      createdAt: o.createdAt.toISOString(),
      user: {
        id: o.user.id,
        name: o.user.name,
        email: o.user.email,
      },
      listings: o.listings.map((l: any) => ({
        id: l.id,
        title: l.title,
        bookingsCount: l.reservations.length,
      })),
      totalBookingsReceived: o.listings.reduce((sum: number, l: any) => sum + l.reservations.length, 0),
    })),
    tenants: tenantsList.map((t) => ({
      id: t.id,
      stellarPublicKey: t.stellarPublicKey,
      createdAt: t.createdAt.toISOString(),
      user: {
        id: t.user.id,
        name: t.user.name,
        email: t.user.email,
      },
      reservations: t.reservations.map((r: any) => ({
        id: r.id,
        status: r.status,
        subtotalUsdt: r.subtotalUsdt,
        listingTitle: r.listing.title,
      })),
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <AdminDashboard initialData={initialData} />
    </div>
  );
}
