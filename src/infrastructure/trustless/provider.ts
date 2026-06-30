import { db } from '../db/client';
import { escrows, reservations, systemConfigs } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface TrustlessEscrowDetails {
  escrowId: string;
  contractAddress: string;
  status: 'pending' | 'funded' | 'released' | 'disputed' | 'resolved' | 'refunded';
  amount: string;
}

export class TrustlessProvider {
  private isMock: boolean;
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.isMock = process.env.TRUSTLESS_MOCK !== 'false';
    this.apiKey = process.env.TRUSTLESS_API_KEY || '';
    this.apiUrl = process.env.TRUSTLESS_API_URL || 'https://api.trustlesswork.com';
  }

  private async apiRequest(path: string, method: 'GET' | 'POST' | 'PUT', body?: any) {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Trustless Work API request failed (${path}): ${response.statusText} - ${errText}`);
    }

    return response.json();
  }

  async createEscrow(
    reservationId: string,
    tenantPublicKey: string,
    ownerPublicKey: string,
    amountUsdt: string
  ): Promise<TrustlessEscrowDetails> {
    if (this.isMock) {
      const mockEscrowId = 'tw_escrow_' + Math.random().toString(36).substring(2, 10);
      const mockContractAddress = 'G_CONTRACT_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      
      console.log(`[MOCK TRUSTLESS] Created escrow ${mockEscrowId} for booking ${reservationId} (Amount: ${amountUsdt} USDT)`);
      
      return {
        escrowId: mockEscrowId,
        contractAddress: mockContractAddress,
        status: 'pending',
        amount: amountUsdt,
      };
    }

    throw new Error('On-chain escrow deployment must be initiated from the client side using the React/Blocks SDK to allow Freighter/user signing.');
  }

  async getEscrowStatus(trustlessEscrowId: string): Promise<TrustlessEscrowDetails['status']> {
    if (this.isMock) {
      const local = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
      });
      return local?.status || 'pending';
    }

    try {
      const escrowRecord = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
      });

      if (!escrowRecord || !escrowRecord.contractAddress) {
        return 'pending';
      }

      const contractAddress = escrowRecord.contractAddress;
      const params = new URLSearchParams();
      params.append('contractIds', contractAddress);
      params.append('validateOnChain', 'true');

      const data = await this.apiRequest(`/helper/get-escrow-by-contract-ids?${params.toString()}`, 'GET');

      if (!Array.isArray(data) || data.length === 0) {
        return 'pending';
      }

      const indexerEscrow = data[0];
      const flags = indexerEscrow.flags;

      if (flags?.disputed) {
        return 'disputed';
      }
      if (flags?.resolved) {
        return 'resolved';
      }
      if (flags?.released) {
        return 'released';
      }
      if (indexerEscrow.balance > 0) {
        return 'funded';
      }

      return 'pending';
    } catch (error) {
      console.error(`Trustless Work getEscrowStatus failed for ${trustlessEscrowId}:`, error);
      return 'pending';
    }
  }

  async releaseEscrow(trustlessEscrowId: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Released escrow ${trustlessEscrowId} back to tenant`);
      return true;
    }

    try {
      const escrowRecord = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
        with: {
          reservation: {
            with: {
              tenant: true,
            },
          },
        },
      });

      if (!escrowRecord) {
        throw new Error(`Escrow record not found for trustlessEscrowId: ${trustlessEscrowId}`);
      }

      const contractAddress = escrowRecord.contractAddress;
      if (!contractAddress) {
        throw new Error(`Stellar contract address is missing for escrow: ${trustlessEscrowId}`);
      }

      const tenantPublicKey = escrowRecord.reservation.tenant.stellarPublicKey;

      const tenantSecretConfig = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, `test_user_secret_${tenantPublicKey}`),
      });

      if (!tenantSecretConfig?.value) {
        throw new Error(`Guest secret key for account ${tenantPublicKey.substring(0, 8)}... not found in database configuration.`);
      }

      const platformSecretKey = process.env.STELLAR_TREASURY_SECRET_KEY;
      const platformPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY;

      if (!platformSecretKey || !platformPublicKey) {
        throw new Error('Platform treasury secret or public key is missing from environment variables.');
      }

      console.log(`[TRUSTLESS] Approving milestone "0" for escrow ${contractAddress}`);
      const approveResult = await this.apiRequest('/escrow/single-release/approve-milestone', 'POST', {
        contractId: contractAddress,
        milestoneIndex: '0',
        approver: tenantPublicKey,
      });

      if (!approveResult.unsignedTransaction) {
        throw new Error('Trustless Work did not return the milestone approval transaction.');
      }

      const networkPassphrase =
        process.env.STELLAR_NETWORK === 'public'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;

      const approveEnvelope = StellarSdk.TransactionBuilder.fromXDR(approveResult.unsignedTransaction, networkPassphrase);
      approveEnvelope.sign(StellarSdk.Keypair.fromSecret(tenantSecretConfig.value));
      
      const signedApproveXdr = approveEnvelope.toXDR();

      const sendApproveResult = await this.apiRequest('/helper/send-transaction', 'POST', {
        signedXdr: signedApproveXdr,
      });

      if (sendApproveResult.status !== 'SUCCESS') {
        throw new Error(`Milestone approval transaction failed: ${sendApproveResult.message || 'Unknown error'}`);
      }

      console.log(`[TRUSTLESS] Releasing funds for escrow ${contractAddress}`);
      const releaseResult = await this.apiRequest('/escrow/single-release/release-funds', 'POST', {
        contractId: contractAddress,
        releaseSigner: platformPublicKey,
      });

      if (!releaseResult.unsignedTransaction) {
        throw new Error('Trustless Work did not return the fund release transaction.');
      }

      const releaseEnvelope = StellarSdk.TransactionBuilder.fromXDR(releaseResult.unsignedTransaction, networkPassphrase);
      releaseEnvelope.sign(StellarSdk.Keypair.fromSecret(platformSecretKey));
      
      const signedReleaseXdr = releaseEnvelope.toXDR();

      const sendReleaseResult = await this.apiRequest('/helper/send-transaction', 'POST', {
        signedXdr: signedReleaseXdr,
      });

      if (sendReleaseResult.status !== 'SUCCESS') {
        throw new Error(`Fund release transaction failed: ${sendReleaseResult.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      console.error(`Trustless Work releaseEscrow failed for ${trustlessEscrowId}:`, error);
      throw error;
    }
  }

  async retainEscrow(trustlessEscrowId: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Retained escrow ${trustlessEscrowId} to owner`);
      return true;
    }

    throw new Error('Retaining single-release escrow is not supported directly. Please file a dispute and resolve it instead.');
  }

  async disputeEscrow(trustlessEscrowId: string, reason: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Opened dispute on escrow ${trustlessEscrowId}. Reason: ${reason}`);
      return true;
    }

    try {
      const escrowRecord = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
        with: {
          reservation: {
            with: {
              listing: {
                with: {
                  owner: true,
                },
              },
            },
          },
        },
      });

      if (!escrowRecord) {
        throw new Error(`Escrow record not found for trustlessEscrowId: ${trustlessEscrowId}`);
      }

      const contractAddress = escrowRecord.contractAddress;
      if (!contractAddress) {
        throw new Error(`Stellar contract address is missing for escrow: ${trustlessEscrowId}`);
      }

      const ownerPublicKey = escrowRecord.reservation.listing.owner.stellarPublicKey;

      const ownerSecretConfig = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, `test_user_secret_${ownerPublicKey}`),
      });

      if (!ownerSecretConfig?.value) {
        throw new Error(`Owner secret key for account ${ownerPublicKey.substring(0, 8)}... not found in database configuration.`);
      }

      console.log(`[TRUSTLESS] Initiating dispute for escrow ${contractAddress} with reason: ${reason}`);
      const disputeResult = await this.apiRequest('/escrow/single-release/dispute-escrow', 'POST', {
        contractId: contractAddress,
        signer: ownerPublicKey,
      });

      if (!disputeResult.unsignedTransaction) {
        throw new Error('Trustless Work did not return the dispute transaction.');
      }

      const networkPassphrase =
        process.env.STELLAR_NETWORK === 'public'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;

      const disputeEnvelope = StellarSdk.TransactionBuilder.fromXDR(disputeResult.unsignedTransaction, networkPassphrase);
      disputeEnvelope.sign(StellarSdk.Keypair.fromSecret(ownerSecretConfig.value));
      
      const signedDisputeXdr = disputeEnvelope.toXDR();

      const sendResult = await this.apiRequest('/helper/send-transaction', 'POST', {
        signedXdr: signedDisputeXdr,
      });

      if (sendResult.status !== 'SUCCESS') {
        throw new Error(`Dispute transaction failed: ${sendResult.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      console.error(`Trustless Work disputeEscrow failed for ${trustlessEscrowId}:`, error);
      return false;
    }
  }

  async resolveDispute(trustlessEscrowId: string, tenantShare: string, ownerShare: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Resolved dispute on escrow ${trustlessEscrowId}. Tenant gets ${tenantShare}, Owner gets ${ownerShare}`);
      return true;
    }

    try {
      const escrowRecord = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
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

      if (!escrowRecord) {
        throw new Error(`Escrow record not found for trustlessEscrowId: ${trustlessEscrowId}`);
      }

      const contractAddress = escrowRecord.contractAddress;
      if (!contractAddress) {
        throw new Error(`Stellar contract address is missing for escrow: ${trustlessEscrowId}`);
      }

      const tenantPublicKey = escrowRecord.reservation.tenant.stellarPublicKey;
      const ownerPublicKey = escrowRecord.reservation.listing.owner.stellarPublicKey;

      const platformSecretKey = process.env.STELLAR_TREASURY_SECRET_KEY;
      const platformPublicKey = process.env.STELLAR_TREASURY_PUBLIC_KEY;

      if (!platformSecretKey || !platformPublicKey) {
        throw new Error('Platform treasury secret or public key is missing from environment variables.');
      }

      const distributions = [];
      if (parseFloat(tenantShare) > 0) {
        distributions.push({
          address: tenantPublicKey,
          amount: parseFloat(tenantShare),
        });
      }
      if (parseFloat(ownerShare) > 0) {
        distributions.push({
          address: ownerPublicKey,
          amount: parseFloat(ownerShare),
        });
      }

      console.log(`[TRUSTLESS] Resolving dispute for escrow ${contractAddress} (Tenant: ${tenantShare}, Owner: ${ownerShare})`);
      const resolveResult = await this.apiRequest('/escrow/single-release/resolve-dispute', 'POST', {
        contractId: contractAddress,
        disputeResolver: platformPublicKey,
        distributions,
      });

      if (!resolveResult.unsignedTransaction) {
        throw new Error('Trustless Work did not return the dispute resolution transaction.');
      }

      const networkPassphrase =
        process.env.STELLAR_NETWORK === 'public'
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET;

      const resolveEnvelope = StellarSdk.TransactionBuilder.fromXDR(resolveResult.unsignedTransaction, networkPassphrase);
      resolveEnvelope.sign(StellarSdk.Keypair.fromSecret(platformSecretKey));
      
      const signedResolveXdr = resolveEnvelope.toXDR();

      const sendResult = await this.apiRequest('/helper/send-transaction', 'POST', {
        signedXdr: signedResolveXdr,
      });

      if (sendResult.status !== 'SUCCESS') {
        throw new Error(`Dispute resolution transaction failed: ${sendResult.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      console.error(`Trustless Work resolveDispute failed for ${trustlessEscrowId}:`, error);
      return false;
    }
  }
}

export const trustlessProvider = new TrustlessProvider();
