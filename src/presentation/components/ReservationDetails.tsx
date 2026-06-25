'use client';

import React, { useState, useTransition } from 'react';
import { Card, Button, Chip, Alert, Input, TextField, Label } from '@heroui/react';
import { toast } from '@heroui/react';
import { executeCheckoutSettlement, fileDispute } from '@/application/actions/booking';
import { ShieldAlert, Landmark, ShieldCheck, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PaymentQRPanel } from './PaymentQRPanel';

interface ReservationDetailsProps {
  reservation: {
    id: string;
    checkIn: string;
    checkOut: string;
    subtotalUsdt: string;
    securityDepositUsdt: string;
    platformFeeUsdt: string;
    status: string;
    listing: {
      title: string;
      city: string;
      country: string;
    };
    paymentIntents: {
      id: string;
      amountUsdt: string;
      status: string;
      expiresAt: string;
      txHash: string | null;
      wallet: {
        id: string;
        publicKey: string;
      };
    }[];
    escrows: {
      id: string;
      contractAddress: string | null;
      amountUsdt: string;
      status: string;
      trustlessEscrowId: string | null;
    }[];
  };
  isMockMode?: boolean;
}

export function ReservationDetails({ reservation, isMockMode = true }: ReservationDetailsProps) {
  const router = useRouter();
  const [isCheckingOut, startCheckout] = useTransition();
  const [isDisputing, startDispute] = useTransition();
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState(reservation.securityDepositUsdt);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const intent = reservation.paymentIntents?.[0];
  const escrow = reservation.escrows?.[0];

  const handleCheckout = () => {
    startCheckout(async () => {
      const result = await executeCheckoutSettlement(reservation.id);
      if (result.success) {
        toast.success('Checkout complete! Rent released to Host. Deposit refunded to Guest.');
        router.refresh();
      } else {
        toast.danger(result.error || 'Checkout settlement failed. Please try again.');
      }
    });
  };

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason) return;
    startDispute(async () => {
      const result = await fileDispute(reservation.id, disputeAmount, disputeReason);
      if (result.success) {
        toast.warning('Dispute filed. Deposit locked pending resolution by protocol admins.');
        setShowDisputeForm(false);
        router.refresh();
      } else {
        toast.danger(result.error || 'Failed to file dispute. Please try again.');
      }
    });
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return <Chip color="warning" variant="soft">Awaiting Payment</Chip>;
      case 'paid':
        return <Chip color="success" variant="soft">Rent Confirmed</Chip>;
      case 'escrowed':
        return <Chip color="accent" variant="primary">Deposit Secured</Chip>;
      case 'active':
        return <Chip color="accent" variant="primary">Stay Active</Chip>;
      case 'completed':
        return <Chip color="success" variant="primary">Completed</Chip>;
      case 'cancelled':
        return <Chip color="danger" variant="soft">Cancelled</Chip>;
      case 'disputed':
        return <Chip color="danger" variant="primary">Disputed</Chip>;
      default:
        return <Chip>{status}</Chip>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left side: Reservation Summary */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <Card className="ambient-lift border-none bg-white p-6 rounded-3xl">
          <Card.Content className="p-0 flex flex-col gap-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Booking ID: #{reservation.id.substring(0, 8)}</span>
                <h2 className="text-2xl font-bold text-[#131b2e] mt-1">{reservation.listing.title}</h2>
                <p className="text-slate-500 text-sm">{reservation.listing.city}, {reservation.listing.country}</p>
              </div>
              <div>{getStatusChip(reservation.status)}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Check-In</span>
                <span className="text-[#131b2e] font-bold mt-1">{new Date(reservation.checkIn).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Check-Out</span>
                <span className="text-[#131b2e] font-bold mt-1">{new Date(reservation.checkOut).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Rent (USDT)</span>
                <span className="text-[#131b2e] font-bold mt-1">{parseFloat(reservation.subtotalUsdt).toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Platform Fee</span>
                <span className="text-[#131b2e] font-bold mt-1">{parseFloat(reservation.platformFeeUsdt).toFixed(2)}</span>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-[#131b2e] text-base">Deposit Protection Status</h3>
              {escrow ? (
                <div className="bg-[#f2f3ff] border border-[#eaedff] p-4 rounded-2xl flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Deposit Reference ID:</span>
                    <span className="font-mono text-slate-700">{escrow.trustlessEscrowId || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Secured Smart Account:</span>
                    <div className="flex items-center gap-1.5 font-mono text-slate-700">
                      <span>{escrow.contractAddress ? `${escrow.contractAddress.substring(0, 8)}...${escrow.contractAddress.slice(-8)}` : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Locked Deposit:</span>
                    <span className="font-bold text-slate-800">{parseFloat(escrow.amountUsdt).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Deposit Status:</span>
                    <Chip size="sm" color={escrow.status === 'funded' ? 'success' : 'default'} variant="soft">{escrow.status.toUpperCase()}</Chip>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-xs">No smart deposit active yet. Awaiting transfer confirmation.</p>
              )}
            </div>
          </Card.Content>
        </Card>

        {/* Guest Stay Verification Controls */}
        {(reservation.status === 'escrowed' || reservation.status === 'active') && (
          <Card className="border border-[#eaedff] bg-white p-6 rounded-3xl">
            <Card.Content className="p-0 flex flex-col gap-4">
              <div>
                <h4 className="font-bold text-[#131b2e] text-base flex items-center gap-1.5">
                  <ShieldCheck size={20} className="text-[#064e3b]" /> Stay Verification
                </h4>
                <p className="text-slate-500 text-xs mt-1">Once checked out, authorize release of rent and deposit funds, or initiate a damage claim.</p>
              </div>

              <div className="flex flex-wrap gap-4 mt-2">
                <Button
                  onPress={handleCheckout}
                  variant="primary"
                  isPending={isCheckingOut}
                  className="font-bold bg-[#064e3b] text-white"
                >
                  Checkout &amp; Release Funds
                </Button>
                <Button
                  onPress={() => setShowDisputeForm(!showDisputeForm)}
                  variant="danger-soft"
                  className="font-semibold"
                >
                  <ShieldAlert size={15} /> Initiate Stay Dispute
                </Button>
              </div>

              {showDisputeForm && (
                <form onSubmit={handleDisputeSubmit} className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField className="w-full flex flex-col gap-1">
                      <Label className="text-sm font-semibold text-slate-700">Claim Amount (USDT)</Label>
                      <Input
                        type="number"
                        value={disputeAmount}
                        onChange={(e) => setDisputeAmount(e.target.value)}
                        max={reservation.securityDepositUsdt}
                        required
                        className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl px-3 py-2 w-full text-sm"
                      />
                    </TextField>
                    <TextField className="w-full flex flex-col gap-1">
                      <Label className="text-sm font-semibold text-slate-700">Reason for Claim</Label>
                      <Input
                        placeholder="Details of damage or dispute..."
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        required
                        className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl px-3 py-2 w-full text-sm"
                      />
                    </TextField>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="secondary" onPress={() => setShowDisputeForm(false)}>Cancel</Button>
                    <Button size="sm" type="submit" variant="danger" isPending={isDisputing}>File Dispute</Button>
                  </div>
                </form>
              )}
            </Card.Content>
          </Card>
        )}

        {reservation.status === 'completed' && (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Protocol Confirmation Complete</Alert.Title>
              <Alert.Description>
                Checkout settled. Rent released to Host account. Platform fee recorded. Deposit refunded back to Guest account.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {reservation.status === 'disputed' && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Dispute Initiated</Alert.Title>
              <Alert.Description>
                The security deposit has been locked in the smart account due to an open dispute. Resolution is currently being processed by protocol admins.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      {/* Right side: Payment Portal */}
      <div className="lg:col-span-4">
        {intent && (
          <Card className="ambient-lift border-none bg-white p-6 rounded-3xl">
            <Card.Content className="p-0 flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-bold text-[#131b2e] flex items-center gap-1.5">
                  <Landmark className="text-[#064e3b]" size={18} /> Protocol Payment Portal
                </h3>
                <p className="text-slate-500 text-xs mt-1">Stellar account payment coordinates.</p>
              </div>

              {intent.status === 'pending' ? (
                <PaymentQRPanel
                  paymentIntentId={intent.id}
                  walletId={intent.wallet.id}
                  walletPublicKey={intent.wallet.publicKey}
                  amountUsdt={intent.amountUsdt}
                  isMockMode={isMockMode}
                />
              ) : (
                <div className="flex flex-col gap-4 text-center items-center py-6">
                  <CheckCircle size={48} className="text-emerald-500" />
                  <div>
                    <h4 className="font-bold text-[#131b2e] text-base">Transfer Confirmed</h4>
                    <p className="text-xs text-slate-500 mt-1">Payment Reference ID:</p>
                    <span className="font-mono text-[10px] text-slate-600 break-all">{intent.txHash || 'Simulated'}</span>
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  );
}
