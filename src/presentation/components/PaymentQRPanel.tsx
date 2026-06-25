'use client';

import React, { useState, useTransition } from 'react';
import { Button, Chip } from '@heroui/react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ScanLine, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@heroui/react';
import { verifyPaymentStatus, simulatePayment } from '@/application/actions/booking';
import { useRouter } from 'next/navigation';

interface PaymentQRPanelProps {
  paymentIntentId: string;
  walletId: string;
  walletPublicKey: string;
  amountUsdt: string;
  isMockMode: boolean;
}

export function PaymentQRPanel({
  paymentIntentId,
  walletId,
  walletPublicKey,
  amountUsdt,
  isMockMode,
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
      const result = await verifyPaymentStatus(paymentIntentId);
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

  const handleSimulate = () => {
    startSimulate(async () => {
      const result = await simulatePayment(
        walletId,
        'GCTENANT455NDJE7QWMEV4SIOTWIEZCA4DZ32C37R7635M262NZKU6GUEP',
        amountUsdt
      );
      if (result.success) {
        toast.success('Simulated deposit confirmed! Protocol state advanced.');
        router.refresh();
      } else {
        toast.danger(result.error || 'Simulation failed');
      }
    });
  };

  const displayAmount = parseFloat(amountUsdt).toFixed(2);

  return (
    <div className="flex flex-col gap-5">
      {/* Amount */}
      <div className="bg-[#f2f3ff] p-5 border border-[#eaedff] rounded-2xl flex flex-col items-center text-center gap-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
          Total Commitment Due
        </span>
        <h3 className="text-3xl font-extrabold text-[#131b2e]">{displayAmount} USDT</h3>
        <Chip size="sm" color="warning" variant="soft" className="mt-1">Awaiting Transfer</Chip>
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
          Send exactly <strong>{displayAmount} USDT</strong> — no memo needed.
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

      {/* Simulator — only visible in mock/dev mode */}
      {isMockMode && (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Dev Simulator — Testnet Only
          </span>
          <p className="text-[11px] text-amber-600 leading-relaxed">
            Click below to simulate the transfer instantly. Triggers ledger scanning and double-entry settlement.
          </p>
          <Button
            onPress={handleSimulate}
            isPending={isSimulating}
            variant="secondary"
            size="sm"
            className="font-bold w-full"
          >
            {isSimulating ? 'Simulating…' : 'Simulate Deposit Confirmation'}
          </Button>
        </div>
      )}
    </div>
  );
}
