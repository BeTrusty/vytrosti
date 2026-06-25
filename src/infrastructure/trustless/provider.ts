import { db } from '../db/client';
import { escrows } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    this.apiUrl = process.env.TRUSTLESS_API_URL || 'https://api.trustless.work';
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

    try {
      const response = await fetch(`${this.apiUrl}/v1/escrows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          tenantAddress: tenantPublicKey,
          ownerAddress: ownerPublicKey,
          amount: amountUsdt,
          asset: 'USDT',
          meta: { reservationId },
        }),
      });

      if (!response.ok) {
        throw new Error(`Trustless Work API creation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        escrowId: data.id,
        contractAddress: data.contractAddress,
        status: 'pending',
        amount: amountUsdt,
      };
    } catch (error) {
      console.error('Trustless Work createEscrow failed:', error);
      throw error;
    }
  }

  async getEscrowStatus(trustlessEscrowId: string): Promise<TrustlessEscrowDetails['status']> {
    if (this.isMock) {
      // In mock mode, we fetch from local DB
      const local = await db.query.escrows.findFirst({
        where: eq(escrows.trustlessEscrowId, trustlessEscrowId),
      });
      return local?.status || 'pending';
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/escrows/${trustlessEscrowId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Trustless Work API getStatus failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.status; // maps to standard statuses
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
      const response = await fetch(`${this.apiUrl}/v1/escrows/${trustlessEscrowId}/release`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error(`Trustless Work releaseEscrow failed for ${trustlessEscrowId}:`, error);
      return false;
    }
  }

  async retainEscrow(trustlessEscrowId: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Retained escrow ${trustlessEscrowId} to owner`);
      return true;
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/escrows/${trustlessEscrowId}/retain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error(`Trustless Work retainEscrow failed for ${trustlessEscrowId}:`, error);
      return false;
    }
  }

  async disputeEscrow(trustlessEscrowId: string, reason: string): Promise<boolean> {
    if (this.isMock) {
      console.log(`[MOCK TRUSTLESS] Opened dispute on escrow ${trustlessEscrowId}. Reason: ${reason}`);
      return true;
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/escrows/${trustlessEscrowId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ reason }),
      });
      return response.ok;
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
      const response = await fetch(`${this.apiUrl}/v1/escrows/${trustlessEscrowId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ tenantShare, ownerShare }),
      });
      return response.ok;
    } catch (error) {
      console.error(`Trustless Work resolveDispute failed for ${trustlessEscrowId}:`, error);
      return false;
    }
  }
}

export const trustlessProvider = new TrustlessProvider();
