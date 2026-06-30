import { db } from '@/infrastructure/db/client';
import { wallets, paymentIntents, reservations, blockchainTransactions } from '@/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import { stellarProvider } from '@/infrastructure/stellar/provider';
import { walletPoolService } from './wallet-pool';
import { ledgerService } from './ledger';

export class PaymentPoller {
  // Main execution loop
  async pollPayments(): Promise<{ processedCount: number; sweptCount: number }> {
    let processedCount = 0;
    let sweptCount = 0;

    // 1. Process cooldown timers first
    const recycledCount = await walletPoolService.processCooldowns();
    if (recycledCount > 0) {
      console.log(`[LEDGER SCANNER] Recycled ${recycledCount} accounts from cooldown to available.`);
    }

    // 2. Load assigned wallets
    const assignedWallets = await db.query.wallets.findMany({
      where: eq(wallets.status, 'assigned'),
    });

    for (const wallet of assignedWallets) {
      const ops = await stellarProvider.pollWalletOperations(
        wallet.publicKey,
        wallet.lastHorizonCursor || undefined
      );

      let lastCursor = wallet.lastHorizonCursor;

      for (const op of ops) {
        lastCursor = op.id;

        // Idempotency check: verify if we already processed this tx hash
        const existingTx = await db.query.blockchainTransactions.findFirst({
          where: eq(blockchainTransactions.txHash, op.txHash),
        });

        if (existingTx) {
          continue;
        }

        // Match with pending payment intent
        const intent = await db.query.paymentIntents.findFirst({
          where: and(
            eq(paymentIntents.walletId, wallet.id),
            eq(paymentIntents.status, 'pending')
          ),
          with: {
            reservation: {
              with: {
                tenant: true,
                listing: {
                  with: {
                    owner: true,
                  },
                },
              },
            },
          },
        });

        if (!intent) {
          console.warn(`[LEDGER SCANNER] Transfer detected on account ${wallet.publicKey} but no active payment intent found.`);
          continue;
        }

        // Verify amount (handling string-based numeric comparison)
        const expected = parseFloat(intent.amountUsdt);
        const actual = parseFloat(op.amount);

        // Allow minor rounding tolerance if needed, but exact matches preferred
        if (Math.abs(actual - expected) > 0.0001) {
          console.warn(`[LEDGER SCANNER] Found transfer ${op.txHash} on account ${wallet.publicKey} but amount mismatch. Expected: ${expected}, Got: ${actual}`);
          continue;
        }

        // Process payment receipt
        await db.transaction(async (tx) => {
          // Log blockchain transaction
          await tx.insert(blockchainTransactions).values({
            walletId: wallet.id,
            txHash: op.txHash,
            amount: op.amount,
            assetCode: op.assetCode,
            fromAddress: op.from,
            toAddress: op.to,
            ledgerCursor: op.id,
          });

          // Mark payment intent as paid
          await tx
            .update(paymentIntents)
            .set({ status: 'paid', txHash: op.txHash })
            .where(eq(paymentIntents.id, intent.id));

          // Mark reservation as paid
          await tx
            .update(reservations)
            .set({ status: 'paid' })
            .where(eq(reservations.id, intent.reservationId));

          // Set wallet to settling
          await tx
            .update(wallets)
            .set({ status: 'settling', lastHorizonCursor: lastCursor, lastPolledAt: new Date() })
            .where(eq(wallets.id, wallet.id));
        });

        // Record Ledger Posting: Receipt of tenant payment
        const reservation = intent.reservation;
        await ledgerService.postEntry(
          `Rental Payment Received for Reservation #${reservation.id.substring(0, 8)}`,
          [
            {
              accountPath: `assets:wallet_pool:${wallet.publicKey}`,
              amount: op.amount,
              direction: 'debit',
            },
            {
              accountPath: `liabilities:tenants:${reservation.tenantId}`,
              amount: op.amount,
              direction: 'credit',
            },
          ],
          'reservation',
          reservation.id
        );

        processedCount++;
      }

      // Update cursor in DB if it changed
      if (lastCursor !== wallet.lastHorizonCursor) {
        await db
          .update(wallets)
          .set({ lastHorizonCursor: lastCursor, lastPolledAt: new Date() })
          .where(eq(wallets.id, wallet.id));
      }
    }

    // 3. Load settling wallets to execute sweeping
    const settlingWallets = await db.query.wallets.findMany({
      where: eq(wallets.status, 'settling'),
    });

    for (const wallet of settlingWallets) {
      // Load reservation details
      const intent = await db.query.paymentIntents.findFirst({
        where: and(
          eq(paymentIntents.walletId, wallet.id),
          eq(paymentIntents.status, 'paid')
        ),
        with: {
          reservation: {
            with: {
              tenant: true,
              listing: {
                with: {
                  owner: true,
                },
              },
            },
          },
        },
      });

      if (!intent) {
        // Fallback wallet status back to cooldown if no paid intent is found
        await walletPoolService.releaseToCooldown(wallet.id);
        continue;
      }

      const res = intent.reservation;
      const platformTreasury = process.env.STELLAR_TREASURY_PUBLIC_KEY;

      if (!platformTreasury) {
        console.error('[POLLER] Platform treasury public key is not set. Cannot sweep funds.');
        continue;
      }

      try {
        const secretKey = await walletPoolService.getWalletSecret(wallet.id);

        // A. Send rent + platform fee to the protocol treasury after the first payment clears.
        const rentAndFee = (parseFloat(res.subtotalUsdt) + parseFloat(res.platformFeeUsdt)).toFixed(4);
        console.log(`[POLLER] Sweeping ${rentAndFee} USDC (rent + fees) from pool wallet ${wallet.publicKey} to treasury ${platformTreasury}`);
        await stellarProvider.sendUsdc(secretKey, platformTreasury, rentAndFee);

        // B. Keep the reservation at "paid" until the deposit is secured in a later escrow step.
        await db.transaction(async (tx) => {
          // Release wallet to cooldown
          await tx
            .update(wallets)
            .set({ status: 'cooldown', lastPolledAt: new Date() })
            .where(eq(wallets.id, wallet.id));
        });

        // C. Ledger entry: sweep pool wallet and recognize owner liability and protocol fee.
        const totalPaidStr = intent.amountUsdt;
        await ledgerService.postEntry(
          `First Payment Sweep for Reservation #${res.id.substring(0, 8)}`,
          [
            // Debit Tenant liability (clearing what we owe/hold for tenant)
            {
              accountPath: `liabilities:tenants:${res.tenantId}`,
              amount: totalPaidStr,
              direction: 'debit',
            },
            // Credit Pool wallet (funds swept out)
            {
              accountPath: `assets:wallet_pool:${wallet.publicKey}`,
              amount: totalPaidStr,
              direction: 'credit',
            },
            // Debit Treasury wallet (receives rent + fees)
            {
              accountPath: `assets:treasury`,
              amount: rentAndFee,
              direction: 'debit',
            },
            // Credit Owner liability (rent owed to owner, platform will pay it on checkout)
            {
              accountPath: `liabilities:owners:${res.listing.ownerId}`,
              amount: res.subtotalUsdt,
              direction: 'credit',
            },
            // Credit Platform fee revenue
            {
              accountPath: `revenue:fees`,
              amount: res.platformFeeUsdt,
              direction: 'credit',
            },
          ],
          'reservation',
          res.id
        );

        sweptCount++;
      } catch (error) {
        console.error(`[LEDGER SCANNER] Failed to sweep/setup escrow for account ${wallet.publicKey}:`, error);
      }
    }

    return { processedCount, sweptCount };
  }
}

export const paymentPoller = new PaymentPoller();
