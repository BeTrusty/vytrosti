import { db } from '@/infrastructure/db/client';
import { wallets, paymentIntents } from '@/infrastructure/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { encryptSecret, decryptSecret } from '@/infrastructure/crypto';
import { stellarProvider } from '@/infrastructure/stellar/provider';

export class WalletPoolService {
  // Add a new wallet to the pool
  async addWalletToPool(publicKey: string, secretKey: string): Promise<void> {
    const { encrypted, iv, tag } = encryptSecret(secretKey);

    await db.insert(wallets).values({
      publicKey,
      encryptedSecretKey: encrypted,
      encryptionIv: iv,
      encryptionTag: tag,
      status: 'available',
    });
  }

  // Get decrypted secret for a wallet (highly secured, internal use only)
  async getWalletSecret(walletId: string): Promise<string> {
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.id, walletId),
    });

    if (!wallet) throw new Error('Wallet not found in pool');

    return decryptSecret(wallet.encryptedSecretKey, wallet.encryptionIv, wallet.encryptionTag);
  }

  // Lease a wallet from the pool for a specific payment intent
  async leaseWallet(reservationId: string, amountUsdt: string, durationMinutes = 30): Promise<string> {
    return await db.transaction(async (tx) => {
      // Find an available wallet
      const availableWallet = await tx.query.wallets.findFirst({
        where: eq(wallets.status, 'available'),
      });

      if (!availableWallet) {
        throw new Error('No wallets available in the pool. Please try again later.');
      }

      // Mark the wallet as assigned
      await tx
        .update(wallets)
        .set({ status: 'assigned' })
        .where(eq(wallets.id, availableWallet.id));

      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Create payment intent
      const [intent] = await tx
        .insert(paymentIntents)
        .values({
          reservationId,
          walletId: availableWallet.id,
          amountUsdt,
          status: 'pending',
          expiresAt,
        })
        .returning();

      return intent.id;
    });
  }

  // Release a wallet back to cooldown
  async releaseToCooldown(walletId: string): Promise<void> {
    await db
      .update(wallets)
      .set({ status: 'cooldown', lastPolledAt: new Date() })
      .where(eq(wallets.id, walletId));
  }

  // Process cooldown wallets: move cooldown -> available after a time buffer (e.g. 10 seconds or 1 minute)
  // This can be triggered during polling
  async processCooldowns(): Promise<number> {
    const cooldownBuffer = new Date(Date.now() - 30 * 1000); // 30 seconds cooldown for hackathon PoC
    
    const results = await db
      .update(wallets)
      .set({ status: 'available' })
      .where(
        and(
          eq(wallets.status, 'cooldown'),
          lte(wallets.lastPolledAt, cooldownBuffer)
        )
      )
      .returning();

    return results.length;
  }

  // Get active leases
  async getActiveLeases() {
    return await db.query.paymentIntents.findMany({
      where: eq(paymentIntents.status, 'pending'),
      with: {
        wallet: true,
        reservation: true,
      },
    });
  }
}

export const walletPoolService = new WalletPoolService();
