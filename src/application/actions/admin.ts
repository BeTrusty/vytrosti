'use server';

import { db } from '@/infrastructure/db/client';
import { disputes, escrows, reservations, users, owners, tenants, ledgerAccounts } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { trustlessProvider } from '@/infrastructure/trustless/provider';
import { ledgerService } from '../services/ledger';
import { revalidatePath } from 'next/cache';

export async function resolveDisputeAction(formData: {
  disputeId: string;
  tenantShareStr: string;
  ownerShareStr: string;
}) {
  try {
    const { disputeId, tenantShareStr, ownerShareStr } = formData;

    const dispute = await db.query.disputes.findFirst({
      where: eq(disputes.id, disputeId),
      with: {
        escrow: true,
      },
    });

    if (!dispute) throw new Error('Dispute not found');
    if (dispute.status !== 'active') throw new Error('Dispute is already resolved');

    const tenantShare = parseFloat(tenantShareStr);
    const ownerShare = parseFloat(ownerShareStr);
    const totalDeposit = parseFloat(dispute.claimedAmountUsdt);

    if (Math.abs(tenantShare + ownerShare - totalDeposit) > 0.0001) {
      throw new Error('Tenant share and Owner share must sum exactly to the disputed deposit amount');
    }

    const escrow = dispute.escrow;
    const trustlessEscrowId = escrow.trustlessEscrowId;
    if (!trustlessEscrowId) throw new Error('Trustless Work Escrow ID is missing');

    // 1. Resolve on Trustless Work contract
    const success = await trustlessProvider.resolveDispute(
      trustlessEscrowId,
      tenantShare.toFixed(4),
      ownerShare.toFixed(4)
    );

    if (!success) throw new Error('Failed to resolve dispute on-chain via Trustless Work');

    // 2. Database update
    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({
          status: 'split_resolution',
          resolutionDetails: `Resolved. Tenant share: ${tenantShare.toFixed(2)} USDT, Owner share: ${ownerShare.toFixed(2)} USDT`,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId));

      await tx
        .update(escrows)
        .set({
          status: 'resolved',
          updatedAt: new Date(),
        })
        .where(eq(escrows.id, escrow.id));

      await tx
        .update(reservations)
        .set({
          status: 'completed',
        })
        .where(eq(reservations.id, dispute.reservationId));
    });

    // 3. Ledger Posting
    // We post a balancing entry to close out the escrow asset accounts
    await ledgerService.postEntry(
      `Dispute Resolution for Reservation #${dispute.reservationId.substring(0, 8)}`,
      [
        // Debit Platform treasury for the portion going to the owner (if any)
        {
          accountPath: `assets:treasury`,
          amount: ownerShare.toFixed(4),
          direction: 'debit',
        },
        // Credit Escrow asset
        {
          accountPath: `assets:escrow:trustless:${escrow.id}`,
          amount: ownerShare.toFixed(4),
          direction: 'credit',
        },
        // Debit/Credit lines for the portion returned to the tenant (rebalancing)
        {
          accountPath: `assets:escrow:trustless:${escrow.id}`,
          amount: tenantShare.toFixed(4),
          direction: 'debit',
        },
        {
          accountPath: `assets:escrow:trustless:${escrow.id}`,
          amount: tenantShare.toFixed(4),
          direction: 'credit',
        },
      ],
      'reservation',
      dispute.reservationId
    );

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Dispute resolution failed',
    };
  }
}

// Seeding action triggered from the Admin UI
export async function runSeedingAction() {
  try {
    const { runDatabaseSeeder } = await import('@/infrastructure/db/seeder');
    await runDatabaseSeeder();

    revalidatePath('/admin');
    return { success: true, message: 'Database successfully seeded with default assets!' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database seeding failed',
    };
  }
}

// Manually trigger poller check
export async function triggerPollerAction() {
  try {
    const { paymentPoller } = await import('../services/poller');
    const results = await paymentPoller.pollPayments();
    revalidatePath('/admin');
    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Poller check failed',
    };
  }
}

// Create new User and Owner/Tenant roles
export async function createUserAction(formData: {
  name: string;
  email: string;
  role: 'owner' | 'tenant' | 'both';
  stellarPublicKey: string;
}) {
  try {
    const { name, email, role, stellarPublicKey } = formData;

    if (!name || !email || !role || !stellarPublicKey) {
      throw new Error('All fields are required');
    }

    await db.transaction(async (tx) => {
      // 1. Insert user
      const [user] = await tx
        .insert(users)
        .values({ name, email })
        .returning();

      // 2. Insert owner profile if applicable
      if (role === 'owner' || role === 'both') {
        const [owner] = await tx
          .insert(owners)
          .values({
            userId: user.id,
            stellarPublicKey,
          })
          .returning();

        // Create liability account for owner
        await tx.insert(ledgerAccounts).values({
          id: `liabilities:owners:${owner.id}`,
          name: `${name} Owed Balance`,
          type: 'liability',
        });
      }

      // 3. Insert tenant profile if applicable
      if (role === 'tenant' || role === 'both') {
        const [tenant] = await tx
          .insert(tenants)
          .values({
            userId: user.id,
            stellarPublicKey,
          })
          .returning();

        // Create liability account for tenant
        await tx.insert(ledgerAccounts).values({
          id: `liabilities:tenants:${tenant.id}`,
          name: `${name} Refundable Deposits`,
          type: 'liability',
        });
      }
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user and profiles',
    };
  }
}

