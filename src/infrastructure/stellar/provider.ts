import * as StellarSdk from '@stellar/stellar-sdk';
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

export interface PollResult {
  operations: StellarTransaction[];
  // Cursor marking the last operation *examined* in this page
  // (even if no operations matched the USDC filter),
  // so the poller can always advance and not get stuck on page 1.
  nextCursor: string | null;
}

export interface StellarAssetReadiness {
  publicKey: string;
  exists: boolean;
  hasTrustline: boolean;
  assetCode: string;
  assetIssuer: string;
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
  async pollWalletOperations(publicKey: string, lastCursor?: string): Promise<PollResult> {
    if (this.isMock) {
      const mockOps = await db.query.blockchainTransactions.findMany({
        where: eq(blockchainTransactions.toAddress, publicKey),
        orderBy: (tx, { asc }) => [asc(tx.processedAt)],
      });
      const ops = mockOps.map((tx) => ({
        id: tx.ledgerCursor,
        txHash: tx.txHash,
        from: tx.fromAddress,
        to: tx.toAddress,
        amount: tx.amount,
        assetCode: tx.assetCode,
        assetIssuer: '',
        createdAt: tx.processedAt.toISOString(),
      }));
      return { operations: ops, nextCursor: ops.length > 0 ? ops[ops.length - 1].id : null };
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      const usdcCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
      const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER || '';

      let nextCursor: string | null = null;
      const txs: StellarTransaction[] = [];

      // Paginate through ALL pages to collect every matching USDC payment
      let page = this.server.operations().forAccount(publicKey).order('asc');
      if (lastCursor) {
        page = page.cursor(lastCursor);
      }

      let response = await page.call();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (const op of response.records) {
          nextCursor = op.paging_token;
          // We only care about payments (payment operations)
          if (op.type === 'payment') {
            const paymentOp = op as StellarSdk.Horizon.ServerApi.PaymentOperationRecord;
            // Filter by USDC asset code & issuer (if defined)
            const isUsdc = paymentOp.asset_code === usdcCode &&
              (!usdcIssuer || paymentOp.asset_issuer === usdcIssuer);

            if (isUsdc) {
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

        const nextResponse = await response.next();
        // If the next page has no records, we've reached the end
        if (nextResponse.records.length === 0) break;
        response = nextResponse;
      }

      return { operations: txs, nextCursor };
    } catch (error) {
      console.error(`Error scanning ledger operations for account ${publicKey}:`, error);
      return { operations: [], nextCursor: null };
    }
  }

  // Send USDC payment
  async sendUsdc(secretKey: string, destination: string, amount: string): Promise<string> {
    if (this.isMock) {
      console.log(`[MOCK STELLAR] Sent ${amount} USDC from S... to ${destination}`);
      return 'mock_tx_hash_' + Math.random().toString(36).substring(2, 15);
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      const sourceAcc = await this.server.loadAccount(sourceKeypair.publicKey());

      const usdcCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
      const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER;
      if (!usdcIssuer) throw new Error('STELLAR_USDC_ASSET_ISSUER environment variable is required for real operations');

      const usdcAsset = new StellarSdk.Asset(usdcCode, usdcIssuer);

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
            asset: usdcAsset,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      console.error('Stellar sendUsdc transfer failed:', error);
      throw error;
    }
  }

  // Create trustline for USDC on a pool wallet
  async establishUsdcTrustline(secretKey: string): Promise<string> {
    if (this.isMock) {
      return 'mock_trustline_tx_hash';
    }

    if (!this.server) throw new Error('Horizon server not initialized');

    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      const sourceAcc = await this.server.loadAccount(sourceKeypair.publicKey());

      const usdcCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
      const usdcIssuer = process.env.STELLAR_USDC_ASSET_ISSUER;
      if (!usdcIssuer) throw new Error('STELLAR_USDC_ASSET_ISSUER is required');

      const usdcAsset = new StellarSdk.Asset(usdcCode, usdcIssuer);
      const networkPassphrase = process.env.STELLAR_NETWORK === 'public' 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET;

      const transaction = new StellarSdk.TransactionBuilder(sourceAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: usdcAsset,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      const result = await this.server.submitTransaction(transaction);
      return result.hash;
    } catch (error) {
      console.error('Stellar establishUsdcTrustline failed:', error);
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
      assetCode: process.env.STELLAR_USDC_ASSET_CODE || 'USDC',
      fromAddress,
      toAddress: wallet.publicKey,
      ledgerCursor: mockCursor,
    });

    return txHash;
  }

  async getAssetReadiness(publicKey: string): Promise<StellarAssetReadiness> {
    const assetCode = process.env.STELLAR_USDC_ASSET_CODE || 'USDC';
    const assetIssuer = process.env.STELLAR_USDC_ASSET_ISSUER || '';

    if (this.isMock) {
      return {
        publicKey,
        exists: true,
        hasTrustline: true,
        assetCode,
        assetIssuer,
      };
    }

    if (!this.server) throw new Error('Horizon server not initialized');
    if (!assetIssuer) throw new Error('STELLAR_USDC_ASSET_ISSUER is required');

    try {
      const account = await this.server.loadAccount(publicKey);
      const hasTrustline = account.balances.some(
        (balance) =>
          balance.asset_type !== 'native' &&
          'asset_code' in balance &&
          balance.asset_code === assetCode &&
          'asset_issuer' in balance &&
          balance.asset_issuer === assetIssuer
      );

      return {
        publicKey,
        exists: true,
        hasTrustline,
        assetCode,
        assetIssuer,
      };
    } catch (error) {
      const horizonError = error as {
        response?: {
          status?: number;
          type?: string;
        };
      };

      const isMissingAccount =
        horizonError?.response?.status === 404 ||
        horizonError?.response?.type === 'https://stellar.org/horizon-errors/not_found';

      if (isMissingAccount) {
        return {
          publicKey,
          exists: false,
          hasTrustline: false,
          assetCode,
          assetIssuer,
        };
      }

      console.error(`Failed to inspect asset readiness for account ${publicKey}:`, error);
      throw error;
    }
  }
}

export const stellarProvider = new StellarProvider();
