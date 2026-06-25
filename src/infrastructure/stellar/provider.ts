import * as StellarSdk from 'stellar-sdk';
import { db } from '../db/client';
import { blockchainTransactions, wallets } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface StellarTransaction {
  id: string; // cursor
  txHash: string;
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer: string;
  createdAt: string;
}

export class StellarProvider {
  private server: StellarSdk.Horizon.Server | null = null;
  private isMock: boolean;

  constructor() {
    this.isMock = process.env.STELLAR_MOCK !== 'false'; // Default to mock for easier local development
    if (!this.isMock) {
      const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
      this.server = new StellarSdk.Horizon.Server(horizonUrl);
    }
  }

  // Create a new keypair
  createKeypair(): { publicKey: string; secretKey: string } {
    const pair = StellarSdk.Keypair.random();
    return {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
    };
  }

  // Poll operations for a wallet address
  async pollWalletOperations(publicKey: string, lastCursor?: string): Promise<StellarTransaction[]> {
    if (this.isMock) {
      // Mocks are handled by simulated deposits in the DB (see mock actions)
      return [];
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      let query = this.server.operations().forAccount(publicKey).order('asc');
      if (lastCursor) {
        query = query.cursor(lastCursor);
      }

      const response = await query.call();
      const usdtCode = process.env.STELLAR_USDT_ASSET_CODE || 'USDT';
      const usdtIssuer = process.env.STELLAR_USDT_ASSET_ISSUER || '';

      const txs: StellarTransaction[] = [];
      for (const op of response.records) {
        // We only care about payments (payment operations)
        if (op.type === 'payment') {
          const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord;
          // Filter by USDT asset code & issuer (if defined)
          const isUsdt = paymentOp.asset_code === usdtCode && 
            (!usdtIssuer || paymentOp.asset_issuer === usdtIssuer);

          if (isUsdt) {
            txs.push({
              id: paymentOp.paging_token,
              txHash: paymentOp.transaction_hash,
              from: paymentOp.from,
              to: paymentOp.to,
              amount: paymentOp.amount,
              assetCode: paymentOp.asset_code || '',
              assetIssuer: paymentOp.asset_issuer || '',
              createdAt: paymentOp.created_at,
            });
          }
        }
      }
      return txs;
    } catch (error) {
      console.error(`Error scanning ledger operations for account ${publicKey}:`, error);
      return [];
    }
  }

  // Send USDT payment
  async sendUsdt(secretKey: string, destination: string, amount: string): Promise<string> {
    if (this.isMock) {
      console.log(`[MOCK STELLAR] Sent ${amount} USDT from S... to ${destination}`);
      return 'mock_tx_hash_' + Math.random().toString(36).substring(2, 15);
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      const sourceAcc = await this.server.loadAccount(sourceKeypair.publicKey());

      const usdtCode = process.env.STELLAR_USDT_ASSET_CODE || 'USDT';
      const usdtIssuer = process.env.STELLAR_USDT_ASSET_ISSUER;
      if (!usdtIssuer) throw new Error('STELLAR_USDT_ASSET_ISSUER environment variable is required for real operations');

      const usdtAsset = new StellarSdk.Asset(usdtCode, usdtIssuer);

      const networkPassphrase = process.env.STELLAR_NETWORK === 'public' 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET;

      const transaction = new StellarSdk.TransactionBuilder(sourceAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: usdtAsset,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      console.error('Stellar sendUsdt transfer failed:', error);
      throw error;
    }
  }

  // Create trustline for USDT on a pool wallet
  async establishUsdtTrustline(secretKey: string): Promise<string> {
    if (this.isMock) {
      return 'mock_trustline_tx_hash';
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      const sourceAcc = await this.server.loadAccount(sourceKeypair.publicKey());

      const usdtCode = process.env.STELLAR_USDT_ASSET_CODE || 'USDT';
      const usdtIssuer = process.env.STELLAR_USDT_ASSET_ISSUER;
      if (!usdtIssuer) throw new Error('STELLAR_USDT_ASSET_ISSUER is required');

      const usdtAsset = new StellarSdk.Asset(usdtCode, usdtIssuer);
      const networkPassphrase = process.env.STELLAR_NETWORK === 'public' 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET;

      const transaction = new StellarSdk.TransactionBuilder(sourceAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: usdtAsset,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      console.error('Stellar establishUsdtTrustline failed:', error);
      throw error;
    }
  }

  // Helper method for the UI to simulate an on-chain transfer in mock mode
  async simulatePaymentDeposit(walletId: string, fromAddress: string, amount: string): Promise<string> {
    if (!this.isMock) {
      throw new Error('Simulation is only allowed when STELLAR_MOCK is active');
    }

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.id, walletId),
    });

    if (!wallet) throw new Error('Wallet not found');

    const txHash = 'mock_tx_hash_' + Math.random().toString(36).substring(2, 15);
    const mockCursor = (Date.now() * 1000).toString();

    // Log the transaction in our database
    await db.insert(blockchainTransactions).values({
      walletId,
      txHash,
      amount,
      assetCode: process.env.STELLAR_USDT_ASSET_CODE || 'USDT',
      fromAddress,
      toAddress: wallet.publicKey,
      ledgerCursor: mockCursor,
    });

    return txHash;
  }
}

export const stellarProvider = new StellarProvider();
