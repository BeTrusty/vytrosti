'use server';

import { db } from '@/infrastructure/db/client';
import { disputes, escrows, reservations, users, owners, tenants, ledgerAccounts, systemConfigs } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { trustlessProvider } from '@/infrastructure/trustless/provider';
import { ledgerService } from '../services/ledger';
import { revalidatePath } from 'next/cache';
import { executeCheckoutSettlement } from './booking';

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

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, dispute.reservationId),
    });
    if (!reservation) throw new Error('Reservation not found');

    const tenantShare = parseFloat(tenantShareStr);
    const ownerShare = parseFloat(ownerShareStr);
    const totalDeposit = parseFloat(dispute.claimedAmountUsdt);

    if (Math.abs(tenantShare + ownerShare - totalDeposit) > 0.0001) {
      throw new Error('Tenant share and Owner share must sum exactly to the disputed deposit amount');
    }

    const escrow = dispute.escrow;
    const escrowAccountPathSuffix = escrow.contractAddress || escrow.id;
    const trustlessEscrowId = escrow.trustlessEscrowId;
    if (!trustlessEscrowId) throw new Error('Trustless Work Escrow ID is missing');

    // 1. Resolve on Trustless Work contract
    const success = await trustlessProvider.resolveDispute(
      trustlessEscrowId,
      tenantShare.toFixed(4),
      ownerShare.toFixed(4)
    );

    if (!success) throw new Error('Failed to resolve dispute on-chain via Trustless Work');

    const disputeStatus =
      ownerShare <= 0
        ? 'resolved_to_tenant'
        : tenantShare <= 0
          ? 'resolved_to_owner'
          : 'split_resolution';

    // 2. Database update
    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({
          status: disputeStatus,
          resolutionDetails: `Resolved. Tenant share: ${tenantShare.toFixed(2)} USDC, Owner share: ${ownerShare.toFixed(2)} USDC`,
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
    // We post a balancing entry to close out the escrow asset accounts and clear the tenant liability
    await ledgerService.postEntry(
      `Dispute Resolution for Reservation #${dispute.reservationId.substring(0, 8)}`,
      [
        // Debit Tenant liability by total deposit (clears our refundable deposit liability to tenant)
        {
          accountPath: `liabilities:tenants:${reservation.tenantId}`,
          amount: totalDeposit.toFixed(4),
          direction: 'debit',
        },
        // Credit Escrow asset by total deposit (clears the escrow account asset balance)
        {
          accountPath: `assets:escrow:trustless:${escrowAccountPathSuffix}`,
          amount: totalDeposit.toFixed(4),
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
    
    // Also sweep and automatically expire any reservations waiting in checkout phase beyond the window
    await checkAndExpireCheckouts();
    
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

export async function checkAndExpireCheckouts(): Promise<{ success: boolean; expiredCount: number; error?: string }> {
  try {
    const disputeWindowConfig = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, 'dispute_window_hours'),
    });
    const windowHours = disputeWindowConfig ? parseFloat(disputeWindowConfig.value) : 72;

    const pendingCheckouts = await db.query.reservations.findMany({
      where: eq(reservations.status, 'checking_out'),
    });

    let expiredCount = 0;
    const now = new Date();

    for (const res of pendingCheckouts) {
      if (res.checkoutClaimedAt) {
        const expirationTime = new Date(res.checkoutClaimedAt.getTime() + windowHours * 60 * 60 * 1000);
        if (now >= expirationTime) {
          const settlementResult = await executeCheckoutSettlement(res.id);
          if (settlementResult.success) {
            expiredCount++;
          }
        }
      }
    }

    if (expiredCount > 0) {
      revalidatePath('/admin');
    }

    return { success: true, expiredCount };
  } catch (error) {
    return {
      success: false,
      expiredCount: 0,
      error: error instanceof Error ? error.message : 'Expiration check failed',
    };
  }
}

export async function setDisputeWindowHoursAction(hours: string): Promise<{ success: boolean; error?: string }> {
  try {
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum < 0) {
      throw new Error('Dispute window must be a valid non-negative number');
    }

    await db
      .insert(systemConfigs)
      .values({
        key: 'dispute_window_hours',
        value: hours,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: {
          value: hours,
          updatedAt: new Date(),
        },
      });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update dispute window configuration',
    };
  }
}
