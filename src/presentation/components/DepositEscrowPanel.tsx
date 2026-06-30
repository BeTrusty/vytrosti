'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Alert, Button } from '@heroui/react';
import { toast } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { Landmark, ShieldCheck } from 'lucide-react';
import { useFundEscrow, useInitializeEscrow, useSendTransaction } from '@trustless-work/escrow/hooks';

interface DepositEscrowPanelProps {
  reservationId: string;
  tenantPublicKey: string;
  ownerPublicKey: string;
  platformPublicKey: string;
  stellarExplorerBaseUrl: string;
  usdcIssuerPublicKey: string;
  securityDepositUsdt: string;
  hasSecretKey: boolean;
  hasTrustlessApiKey: boolean;
  isTrustlessMockMode: boolean;
  existingEscrow?: {
    contractAddress: string | null;
    trustlessEscrowId: string | null;
    status: string;
  } | null;
}

interface AccountReadiness {
  publicKey: string;
  exists: boolean;
  hasTrustline: boolean;
  assetCode: string;
  assetIssuer: string;
}

interface PreflightReadiness {
  receiver: AccountReadiness;
  platformAddress: AccountReadiness;
}

async function signEnvelope(reservationId: string, unsignedTransaction: string) {
  const response = await fetch('/api/trustless/sign-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reservationId,
      unsignedTransaction,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success || typeof data.signedXdr !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not sign the Trustless Work envelope.');
  }

  return data.signedXdr;
}

export function DepositEscrowPanel({
  reservationId,
  tenantPublicKey,
  ownerPublicKey,
  platformPublicKey,
  stellarExplorerBaseUrl,
  usdcIssuerPublicKey,
  securityDepositUsdt,
  hasSecretKey,
  hasTrustlessApiKey,
  isTrustlessMockMode,
  existingEscrow,
}: DepositEscrowPanelProps) {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const [preflightReadiness, setPreflightReadiness] = useState<PreflightReadiness | null>(null);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const { deployEscrow } = useInitializeEscrow();
  const { fundEscrow } = useFundEscrow();
  const { sendTransaction } = useSendTransaction();

  const missingConfig = !tenantPublicKey || !ownerPublicKey || !platformPublicKey || !usdcIssuerPublicKey;
  const blockedAccounts = !preflightReadiness
    ? []
    : [
        { role: 'receiver', readiness: preflightReadiness.receiver, label: 'Host account' },
        { role: 'platformAddress', readiness: preflightReadiness.platformAddress, label: 'Platform account' },
      ].filter((entry) => entry.readiness.exists === false || entry.readiness.hasTrustline === false);

  useEffect(() => {
    if (isTrustlessMockMode || !hasTrustlessApiKey || missingConfig) {
      return;
    }

    let cancelled = false;

    async function loadPreflightReadiness() {
      setIsCheckingPreflight(true);
      setPreflightError(null);

      try {
        const response = await fetch('/api/trustless/preflight', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reservationId }),
        });

        const data = await response.json();

        if (!response.ok || !data.success || !data.readiness) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Could not validate the Trustless Work accounts.');
        }

        if (!cancelled) {
          setPreflightReadiness(data.readiness);
        }
      } catch (error) {
        if (!cancelled) {
          setPreflightError(error instanceof Error ? error.message : 'Could not validate the Trustless Work accounts.');
        }
      } finally {
        if (!cancelled) {
          setIsCheckingPreflight(false);
        }
      }
    }

    void loadPreflightReadiness();

    return () => {
      cancelled = true;
    };
  }, [hasTrustlessApiKey, isTrustlessMockMode, missingConfig, reservationId]);

  const handleSecureDeposit = () => {
    startTransition(async () => {
      try {
        if (isTrustlessMockMode) {
          const response = await fetch('/api/dev/mock-escrow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reservationId }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(typeof data.error === 'string' ? data.error : 'Mock deposit funding failed.');
          }

          toast.success('Mock deposit secured. The reservation is now protected.');
          router.refresh();
          return;
        }

        if (!hasTrustlessApiKey) {
          throw new Error('Trustless Work API key is missing from the server configuration.');
        }

        if (!hasSecretKey) {
          throw new Error('A guest development secret key is required to sign the Trustless Work envelope.');
        }

        if (missingConfig) {
          throw new Error('Trustless Work setup is incomplete. Please verify the account and asset configuration.');
        }

        if (blockedAccounts.length > 0) {
          throw new Error('Some required Stellar accounts are not ready yet. Review the preflight panel before retrying.');
        }

        const escrowAmount = Number.parseFloat(securityDepositUsdt);
        const existingContractId = existingEscrow?.contractAddress || null;
        const existingEngagementId = existingEscrow?.trustlessEscrowId || `reservation-${reservationId}`;

        let contractId = existingContractId;
        let engagementId = existingEngagementId;

        if (!contractId) {
          const initializeResponse = await deployEscrow(
            {
              signer: tenantPublicKey,
              engagementId,
              title: `Vytrosti reservation ${reservationId.substring(0, 8)}`,
              description: 'Security deposit for a confirmed Vytrosti reservation.',
              amount: escrowAmount,
              platformFee: 0,
              trustline: {
                address: usdcIssuerPublicKey,
                symbol: 'USDC',
              },
              roles: {
                approver: tenantPublicKey,
                serviceProvider: ownerPublicKey,
                platformAddress: platformPublicKey,
                releaseSigner: platformPublicKey,
                disputeResolver: platformPublicKey,
                receiver: ownerPublicKey,
              },
              milestones: [
                {
                  description: 'Hold the security deposit until checkout or a dispute resolution.',
                },
              ],
            },
            'single-release'
          );

          if (!initializeResponse.unsignedTransaction) {
            throw new Error('Trustless Work did not return the initialization envelope.');
          }

          const signedInitialization = await signEnvelope(reservationId, initializeResponse.unsignedTransaction);
          const initializationResult = await sendTransaction(signedInitialization);

          if (initializationResult.status !== 'SUCCESS' || !('contractId' in initializationResult)) {
            throw new Error('Trustless Work rejected the escrow initialization.');
          }

          contractId = initializationResult.contractId;
          engagementId =
            'escrow' in initializationResult && initializationResult.escrow?.engagementId
              ? initializationResult.escrow.engagementId
              : engagementId;

          const recordInitialization = await fetch('/api/trustless/escrows/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              stage: 'initialized',
              reservationId,
              contractId,
              engagementId,
              amountUsdt: securityDepositUsdt,
            }),
          });

          const initializationRecord = await recordInitialization.json();
          if (!recordInitialization.ok || !initializationRecord.success) {
            throw new Error(typeof initializationRecord.error === 'string' ? initializationRecord.error : 'Could not save the draft escrow.');
          }
        }

        const fundResponse = await fundEscrow(
          {
            contractId,
            amount: escrowAmount,
            signer: tenantPublicKey,
          },
          'single-release'
        );

        if (!fundResponse.unsignedTransaction) {
          throw new Error('Trustless Work did not return the funding envelope.');
        }

        const signedFunding = await signEnvelope(reservationId, fundResponse.unsignedTransaction);
        const fundingResult = await sendTransaction(signedFunding);

        if (fundingResult.status !== 'SUCCESS') {
          throw new Error('Trustless Work rejected the deposit funding.');
        }

        const recordFunding = await fetch('/api/trustless/escrows/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stage: 'funded',
            reservationId,
            contractId,
            engagementId,
            amountUsdt: securityDepositUsdt,
          }),
        });

        const fundingRecord = await recordFunding.json();
        if (!recordFunding.ok || !fundingRecord.success) {
          throw new Error(typeof fundingRecord.error === 'string' ? fundingRecord.error : 'Could not save the funded escrow.');
        }

        toast.success('Deposit secured. The reservation is now protected.');
        router.refresh();
      } catch (error: any) {
        let errMsg = 'Could not secure the deposit.';
        if (error.response?.data?.message) {
          errMsg = typeof error.response.data.message === 'string'
            ? error.response.data.message
            : JSON.stringify(error.response.data.message);
          if (error.response.data.details) {
            errMsg += `: ${JSON.stringify(error.response.data.details)}`;
          }
        } else if (error instanceof Error) {
          errMsg = error.message;
        }
        toast.danger(errMsg);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#eaedff] bg-[#f8faff] p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white p-2 text-[#064e3b] shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-[#131b2e]">Secure the Deposit</h4>
          <p className="text-xs leading-relaxed text-slate-500">
            The first payment is already confirmed. This step initializes the Trustless Work agreement and moves the
            {` ${Number.parseFloat(securityDepositUsdt).toFixed(2)} USDC `}deposit into protected custody.
          </p>
        </div>
      </div>

      {!isTrustlessMockMode && (!hasTrustlessApiKey || missingConfig) && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Configuration Required</Alert.Title>
            <Alert.Description>
              Add the Trustless Work API key, the treasury account, and the USDC issuer before funding this deposit.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {!hasSecretKey && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Developer Signature Needed</Alert.Title>
            <Alert.Description>
              This environment signs the Trustless Work envelopes on the server with the guest development secret key stored in the database.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {!isTrustlessMockMode && isCheckingPreflight && (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Validating Trustless Work Accounts</Alert.Title>
            <Alert.Description>
              Checking that the host and platform accounts exist and trust the configured USDC asset before creating the protected deposit.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {!isTrustlessMockMode && preflightError && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could Not Validate Trustless Work Accounts</Alert.Title>
            <Alert.Description>{preflightError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {!isTrustlessMockMode && blockedAccounts.length > 0 && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Accounts Need Setup</Alert.Title>
            <Alert.Description>
              <div className="flex flex-col gap-3">
                {blockedAccounts.map(({ role, readiness, label }) => {
                  const explorerUrl = `${stellarExplorerBaseUrl}${readiness.publicKey}`;
                  const needsActivation = readiness.exists === false;
                  return (
                    <div key={role} className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-700">{label}</span>
                      <span>
                        {needsActivation
                          ? `The account is not active yet. Fund it with XLM before creating the escrow.`
                          : `The account is active but still needs the ${readiness.assetCode} trustline for issuer ${readiness.assetIssuer}.`}
                      </span>
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#064e3b] underline underline-offset-2"
                      >
                        Open in Stellar Expert
                      </a>
                    </div>
                  );
                })}
              </div>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Button
        onPress={handleSecureDeposit}
        isPending={isSubmitting}
        variant="primary"
        className="h-11 bg-[#003527] font-bold text-white"
        isDisabled={
          isSubmitting ||
          isCheckingPreflight ||
          (!isTrustlessMockMode && (!hasSecretKey || !hasTrustlessApiKey || missingConfig || blockedAccounts.length > 0))
        }
      >
        <Landmark size={16} />
        {existingEscrow?.contractAddress ? 'Complete Deposit Funding' : 'Secure Deposit with Trustless Work'}
      </Button>
    </div>
  );
}
