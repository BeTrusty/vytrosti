'use client';

import React, { useState, useTransition } from 'react';
import { Button, Chip } from '@heroui/react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ScanLine, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@heroui/react';
import { useRouter } from 'next/navigation';

interface PaymentQRPanelProps {
  paymentIntentId: string;
  walletId: string;
  walletPublicKey: string;
  amountUsdt: string;
  securityDepositUsdt: string;
  isMockMode: boolean;
  guestPublicKey: string;
  platformPublicKey: string;
  stellarExplorerBaseUrl: string;
  hasSecretKey: boolean;
}

export function PaymentQRPanel({
  paymentIntentId,
  walletId,
  walletPublicKey,
  amountUsdt,
  securityDepositUsdt,
  isMockMode,
  guestPublicKey,
  platformPublicKey,
  stellarExplorerBaseUrl,
  hasSecretKey,
}: PaymentQRPanelProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isVerifying, startVerify] = useTransition();
  const [isSimulating, startSimulate] = useTransition();

  const handleCopy = () => {
    navigator.clipboard.writeText(walletPublicKey);
    setCopied(true);
    toast.success('Account address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    startVerify(async () => {
      const result = await fetch('/api/dev/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
        }),
      }).then(async (response) => {
        const data = await response.json();
        return {
          success: Boolean(data.success),
          paymentDetected: Boolean(data.paymentDetected),
          status: typeof data.status === 'string' || data.status === null ? data.status : null,
          error: typeof data.error === 'string' ? data.error : undefined,
        };
      });

      if (!result.success) {
        toast.danger(result.error || 'Verification failed. Please try again.');
        return;
      }
      if (result.paymentDetected) {
        toast.success('Transfer confirmed! Reservation is now active.');
        router.refresh();
      } else {
        toast.info('No transfer detected yet. The protocol scans ledger every 60 seconds.');
      }
    });
  };

  const handleExecuteMockPayment = () => {
    startSimulate(async () => {
      const result = isMockMode
        ? await fetch('/api/dev/mock-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              walletId,
              guestPublicKey,
              amountUsdt,
            }),
          }).then(async (response) => {
            const data = await response.json();
            return {
              success: Boolean(data.success),
              txHash: typeof data.txHash === 'string' ? data.txHash : undefined,
              error: typeof data.error === 'string' ? data.error : undefined,
            };
          })
        : await fetch('/api/dev/execute-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              paymentIntentId,
            }),
          }).then(async (response) => {
            const data = await response.json();
            return {
              success: Boolean(data.success),
              txHash: typeof data.txHash === 'string' ? data.txHash : undefined,
              error: typeof data.error === 'string' ? data.error : undefined,
            };
          });

      if (result.success) {
        const txHref =
          result.txHash && !result.txHash.startsWith('mock_')
            ? stellarExplorerBaseUrl.replace('/account/', '/tx/') + result.txHash
            : null;

        toast.success(
          isMockMode
            ? 'Mock transfer submitted! Please click Verify Payment to scan the ledger.'
            : 'Testnet transfer submitted! Please click Verify Payment to scan the ledger.',
          {
            description: result.txHash ? (
              txHref ? (
                <a
                  href={txHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-700 underline underline-offset-2"
                >
                  View transfer on the network
                </a>
              ) : (
                <span className="text-slate-600">Reference: {result.txHash}</span>
              )
            ) : undefined,
            timeout: 0,
          }
        );
      } else {
        toast.danger(result.error || 'Mock payment failed');
      }
    });
  };

  const displayAmount = parseFloat(amountUsdt).toFixed(2);
  const displayDeposit = parseFloat(securityDepositUsdt).toFixed(2);
  const demoModeLabel = isMockMode
    ? 'Local'
    : hasSecretKey
      ? 'Guest'
      : 'Fallback';
  const demoTitle = 'Demo transfer';
  const demoDescription = isMockMode
    ? 'Run a local preview transfer.'
    : hasSecretKey
      ? 'Send the review amount from the guest account.'
      : 'Guest access is missing, so we will send it from the platform account.';
  const demoButtonLabel = isMockMode
    ? 'Run demo'
    : hasSecretKey
      ? 'Send demo'
      : 'Use fallback';
  const sourcePublicKey = !isMockMode && !hasSecretKey ? platformPublicKey : guestPublicKey;
  const sourceLabel = !isMockMode && !hasSecretKey ? 'Platform account' : 'Guest account';
  const destinationLabel = 'Intake account';
  const sourceHref = sourcePublicKey ? `${stellarExplorerBaseUrl}${sourcePublicKey}` : null;
  const destinationHref = walletPublicKey ? `${stellarExplorerBaseUrl}${walletPublicKey}` : null;
  const shortenAddress = (value: string) => `${value.slice(0, 8)}...${value.slice(-8)}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Amount */}
      <div className="bg-[#f2f3ff] p-5 border border-[#eaedff] rounded-2xl flex flex-col items-center text-center gap-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
          First Payment Due
        </span>
        <h3 className="text-3xl font-extrabold text-[#131b2e]">{displayAmount} USDC</h3>
        <Chip size="sm" color="warning" variant="soft" className="mt-1">Awaiting Transfer</Chip>
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
          Deposit shown separately: <strong>{displayDeposit} USDC</strong> will be secured in escrow in a later step.
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 self-start">Scan to Pay</span>
        <div className="bg-white border-2 border-[#eaedff] rounded-2xl p-4 flex items-center justify-center shadow-sm">
          <QRCodeSVG
            value={walletPublicKey}
            size={180}
            fgColor="#131b2e"
            bgColor="#ffffff"
            level="M"
            includeMargin={false}
          />
        </div>
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Scan with any Stellar-compatible app.<br />
          Send exactly <strong>{displayAmount} USDC</strong> — no memo needed.
        </p>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-500 font-semibold">
          Stellar Account Coordinates
        </label>
        <div className="bg-[#f2f3ff] border border-[#eaedff] rounded-xl p-3 flex justify-between items-center gap-2">
          <span className="font-mono text-slate-600 break-all text-left text-[11px] leading-relaxed">
            {walletPublicKey}
          </span>
          <button
            onClick={handleCopy}
            className="text-[#064e3b] hover:text-[#003527] flex-shrink-0 transition-colors"
            title="Copy address"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* ── PRIMARY: Verify Payment button ── */}
      <Button
        onPress={handleVerify}
        isPending={isVerifying}
        variant="primary"
        className="w-full font-bold bg-[#003527] text-white rounded-xl h-12 text-sm flex items-center justify-center gap-2"
      >
        {isVerifying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Scanning Ledger…</span>
          </>
        ) : (
          <>
            <ScanLine size={16} />
            <span>Verify Payment</span>
          </>
        )}
      </Button>

      {/* Simulator — ALWAYS visible for Hackathon evaluation */}
      {true && (
        <div className="precision-callout precision-callout--amber">
          <div className="precision-callout__rail" />
          <div className="precision-callout__body">
            <div className="precision-callout__header">
              <div className="precision-callout__intro">
                <span className="precision-callout__eyebrow">
                  <Sparkles size={14} className="precision-callout__icon" />
                  Demo transfer
                </span>
                <h4 className="precision-callout__title">{demoTitle}</h4>
                <p className="precision-callout__copy">{demoDescription}</p>
              </div>
              <Chip
                size="sm"
                variant="flat"
                className="precision-callout__chip"
              >
                {demoModeLabel}
              </Chip>
            </div>

            <div className="precision-callout__meta">
              <div className="precision-callout__meta-row precision-callout__meta-row--stacked">
                <span className="precision-callout__meta-label">Route</span>
                <span className="precision-callout__meta-value precision-callout__meta-value--route">
                  {sourceHref ? (
                    <a
                      href={sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="precision-callout__meta-link"
                    >
                      {sourceLabel}: {shortenAddress(sourcePublicKey)}
                    </a>
                  ) : (
                    <span>{sourceLabel}: unavailable</span>
                  )}
                  <span className="precision-callout__meta-arrow">→</span>
                  {destinationHref ? (
                    <a
                      href={destinationHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="precision-callout__meta-link"
                    >
                      {destinationLabel}: {shortenAddress(walletPublicKey)}
                    </a>
                  ) : (
                    <span>{destinationLabel}: unavailable</span>
                  )}
                </span>
              </div>
              <div className="precision-callout__meta-row">
                <span className="precision-callout__meta-label">Amount</span>
                <span className="precision-callout__meta-value precision-callout__meta-value--strong">
                  {displayAmount} USDC
                </span>
              </div>
            </div>

            <Button
              onPress={handleExecuteMockPayment}
              isPending={isSimulating}
              variant="secondary"
              className="precision-callout__action"
            >
              {isSimulating ? 'Submitting…' : demoButtonLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
