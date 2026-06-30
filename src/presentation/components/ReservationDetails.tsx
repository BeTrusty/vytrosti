'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Card, Button, Chip, Alert, Input, TextField, Label } from '@heroui/react';
import { toast } from '@heroui/react';
import { ShieldAlert, Landmark, ShieldCheck, CheckCircle, ExternalLink, Timer, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { PaymentQRPanel } from './PaymentQRPanel';
import { DepositEscrowPanel } from './DepositEscrowPanel';
import { FundsMovementCard } from './FundsMovementCard';

type JourneyStepState = 'complete' | 'current' | 'upcoming' | 'warning';

type DepositPaymentStatusTone = 'success' | 'danger' | 'warning' | 'default';

type DepositPaymentStatus = {
  tone: DepositPaymentStatusTone;
  badge: string;
  description: string;
};

function getJourneyStepState(order: number, current: number, hasWarning = false): JourneyStepState {
  if (hasWarning) return 'warning';
  if (order < current) return 'complete';
  if (order === current) return 'current';
  return 'upcoming';
}

function getDepositPaymentStatus(
  reservationStatus: string,
  escrow:
    | {
        status: string;
        latestDispute: {
          status: string;
          resolutionDetails: string;
        } | null;
      }
    | undefined,
): DepositPaymentStatus {
  if (!escrow) {
    return reservationStatus === 'paid'
      ? {
          tone: 'warning',
          badge: 'Next step',
          description: 'The first payment is complete. The deposit now needs its protected custody step.',
        }
      : {
          tone: 'default',
          badge: 'Waiting',
          description: 'The deposit status will appear here once the payment phase is complete.',
        };
  }

  if (escrow.status === 'disputed' || reservationStatus === 'disputed') {
    return {
      tone: 'danger',
      badge: 'In dispute',
      description: 'A host claim is open and the protected deposit remains locked until the review is resolved.',
    };
  }

  if (escrow.status === 'released') {
    return {
      tone: 'success',
      badge: 'Returned',
      description: 'The protected deposit was released back to the guest after checkout.',
    };
  }

  if (escrow.status === 'resolved') {
    switch (escrow.latestDispute?.status) {
      case 'resolved_to_owner':
        return {
          tone: 'warning',
          badge: 'Retained',
          description: 'The review is complete and the protected deposit was awarded to the host.',
        };
      case 'resolved_to_tenant':
        return {
          tone: 'success',
          badge: 'Returned',
          description: 'The review is complete and the protected deposit was returned to the guest.',
        };
      case 'split_resolution':
        return {
          tone: 'warning',
          badge: 'Partially retained',
          description: 'The review is complete and the protected deposit was split between guest and host.',
        };
      default:
        return {
          tone: 'success',
          badge: 'Resolved',
          description: escrow.latestDispute?.resolutionDetails || 'The review is complete and the protected deposit has been settled.',
        };
    }
  }

  if (escrow.status === 'funded') {
    return {
      tone: 'success',
      badge: 'Protected',
      description: 'The deposit is already protected and linked to this reservation.',
    };
  }

  return {
    tone: 'default',
    badge: 'Pending',
    description: 'Protected custody is still being prepared for this reservation.',
  };
}

interface ReservationDetailsProps {
  reservation: {
    id: string;
    checkIn: string;
    checkOut: string;
    subtotalUsdt: string;
    securityDepositUsdt: string;
    platformFeeUsdt: string;
    status: string;
    checkoutClaimedAt: string | null;
    tenantPublicKey: string;
    ownerPublicKey: string;
    platformPublicKey: string;
    stellarExplorerBaseUrl: string;
    usdcIssuerPublicKey: string;
    hasSecretKey: boolean;
    hasTrustlessApiKey: boolean;
    listing: {
      title: string;
      city: string;
      country: string;
    };
    tenantName: string;
    ownerName: string;
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
      latestDispute: {
        status: string;
        resolutionDetails: string;
      } | null;
    }[];
  };
  isMockMode?: boolean;
  isTrustlessMockMode?: boolean;
  roleContext: {
    isTenant: boolean;
    isOwner: boolean;
    isAdmin: boolean;
  };
  disputeWindowHours: number;
}

export function ReservationDetails({
  reservation,
  isMockMode = true,
  isTrustlessMockMode = true,
  roleContext,
  disputeWindowHours,
}: ReservationDetailsProps) {
  const router = useRouter();
  const [isCheckingOut, startCheckout] = useTransition();
  const [isDisputing, startDispute] = useTransition();
  const [isRequestingCheckout, startRequestCheckout] = useTransition();
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState(reservation.securityDepositUsdt);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [isDepositDetailsOpen, setIsDepositDetailsOpen] = useState(false);

  const [now, setNow] = useState(() => new Date());

  // Initialize client-only timer to avoid SSR hydration mismatch
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const intent = reservation.paymentIntents?.[0];
  const escrow = reservation.escrows?.[0];
  const hasConfirmedFirstPayment = intent?.status === 'paid';
  const isDepositSecured = Boolean(escrow && ['funded', 'released', 'resolved'].includes(escrow.status));
  const depositPaymentStatus = getDepositPaymentStatus(reservation.status, escrow);
  const isCheckoutPhase =
    reservation.status === 'checking_out' || reservation.status === 'completed' || reservation.status === 'disputed';

  const currentJourneyStep =
    reservation.status === 'completed'
      ? 5
      : reservation.status === 'disputed'
        ? 4
        : reservation.status === 'checking_out'
          ? 4
          : reservation.status === 'escrowed' || reservation.status === 'active'
            ? 3
            : reservation.status === 'paid'
              ? 2
              : 1;

  const checkoutClaimedTime = reservation.checkoutClaimedAt ? new Date(reservation.checkoutClaimedAt) : null;
  const expirationDate = checkoutClaimedTime
    ? new Date(checkoutClaimedTime.getTime() + disputeWindowHours * 60 * 60 * 1000)
    : null;

  const isWindowExpired = expirationDate && now ? now >= expirationDate : false;

  const getRemainingTimeStr = () => {
    if (!expirationDate || !now) return '';
    const diffMs = expirationDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';

    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleRequestCheckout = () => {
    startRequestCheckout(async () => {
      const result = await fetch(`/api/reservations/${reservation.id}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'request',
        }),
      }).then(async (response) => {
        const data = await response.json();
        return {
          success: Boolean(data.success),
          error: typeof data.error === 'string' ? data.error : undefined,
        };
      });

      if (result.success) {
        toast.success('Checkout requested! Dispute and review window has started.');
        router.refresh();
      } else {
        toast.danger(result.error || 'Failed to request checkout.');
      }
    });
  };

  const handleCheckout = () => {
    startCheckout(async () => {
      const result = await fetch(`/api/reservations/${reservation.id}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'settle',
        }),
      }).then(async (response) => {
        const data = await response.json();
        return {
          success: Boolean(data.success),
          error: typeof data.error === 'string' ? data.error : undefined,
        };
      });

      if (result.success) {
        toast.success('Checkout settled! Deposit returned and stay complete.');
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
      const result = await fetch(`/api/reservations/${reservation.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claimedAmount: disputeAmount,
          reason: disputeReason,
        }),
      }).then(async (response) => {
        const data = await response.json();
        return {
          success: Boolean(data.success),
          error: typeof data.error === 'string' ? data.error : undefined,
        };
      });

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
        return <Chip color="success" variant="soft">First Payment Confirmed</Chip>;
      case 'escrowed':
        return <Chip color="accent" variant="primary">Deposit Secured</Chip>;
      case 'active':
        return <Chip color="accent" variant="primary">Stay Active</Chip>;
      case 'checking_out':
        return <Chip color="warning" variant="primary">Checking Out</Chip>;
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

  const paymentJourney = [
    {
      title: 'Confirm first payment',
      summary: hasConfirmedFirstPayment ? 'Payment completed' : 'Awaiting transfer',
      description: hasConfirmedFirstPayment
        ? 'Rent and platform fee are already confirmed in the protocol.'
        : 'Use the payment panel on the left to complete the first transfer.',
      state: getJourneyStepState(1, currentJourneyStep),
    },
    {
      title: 'Secure deposit',
      summary: isDepositSecured ? 'Deposit protected' : 'Next required step',
      description: isDepositSecured
        ? 'The deposit is already protected in Trustless Work custody.'
        : 'This is the next required step before the stay can fully advance.',
      state: getJourneyStepState(2, currentJourneyStep),
    },
    {
      title: 'Stay active',
      summary:
        reservation.status === 'escrowed' || reservation.status === 'active' || isCheckoutPhase
          ? 'Stay enabled'
          : 'Waiting for deposit',
      description:
        reservation.status === 'escrowed' || reservation.status === 'active' || isCheckoutPhase
          ? 'The stay can continue with the deposit protection in place.'
          : 'The stay becomes active after the deposit is secured.',
      state: getJourneyStepState(3, currentJourneyStep),
    },
    {
      title: 'Checkout review',
      summary:
        reservation.status === 'disputed'
          ? 'Dispute in review'
          : reservation.status === 'checking_out'
            ? 'Review window active'
            : reservation.status === 'completed'
              ? 'Completed'
              : 'Opens at checkout',
      description:
        reservation.status === 'disputed'
          ? 'A dispute is open and the protected deposit remains locked until resolution.'
          : reservation.status === 'checking_out'
            ? 'Checkout is in progress while the review window remains open.'
            : reservation.status === 'completed'
              ? 'Checkout review finished and the protected deposit was settled.'
              : 'Guest checkout opens the review window for host approval or claim.',
      state: getJourneyStepState(4, currentJourneyStep, reservation.status === 'disputed'),
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left side: Reservation Summary + Payment */}
      <div className="lg:col-span-7 flex flex-col gap-6">
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
                <span className="text-slate-400 font-semibold">Rent (USDC)</span>
                <span className="text-[#131b2e] font-bold mt-1">{parseFloat(reservation.subtotalUsdt).toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Platform Fee</span>
                <span className="text-[#131b2e] font-bold mt-1">{parseFloat(reservation.platformFeeUsdt).toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl bg-[#f8f8ff] border border-[#eaedff] p-4 text-sm">
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">Security Deposit</span>
                {escrow ? (
                  <button
                    type="button"
                    onClick={() => setIsDepositDetailsOpen(true)}
                    className="mt-1 flex flex-col items-start rounded-xl border border-emerald-100 bg-white px-3 py-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <span className="text-[#131b2e] font-bold">{parseFloat(reservation.securityDepositUsdt).toFixed(2)} USDC</span>
                    <span className="text-xs text-emerald-700">Open protection details</span>
                  </button>
                ) : (
                  <span className="text-[#131b2e] font-bold mt-1">{parseFloat(reservation.securityDepositUsdt).toFixed(2)} USDC</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400 font-semibold">First Payment Commitment</span>
                <span className="text-[#064e3b] font-bold mt-1">
                  {(parseFloat(reservation.subtotalUsdt) + parseFloat(reservation.platformFeeUsdt)).toFixed(2)} USDC
                </span>
              </div>
            </div>
          </Card.Content>
        </Card>

        {intent && (
          <Card className="ambient-lift border-none bg-white p-6 rounded-3xl">
            <Card.Content className="p-0 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-[#131b2e] flex items-center gap-1.5">
                  <Landmark className="text-[#064e3b]" size={18} /> Payment Status
                </h3>
                <p className="text-slate-500 text-xs">Track the first payment and the deposit protection for this reservation.</p>
              </div>

              {intent.status === 'pending' ? (
                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fcfefd_0%,#f8fafc_100%)] p-4">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-[18px] border border-amber-100 bg-white/90 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                            <Landmark size={20} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-[#131b2e] text-sm">First payment</h4>
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                Awaiting transfer
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Open the current step in Reservation Progress to scan, verify, or run the demo transfer.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Amount
                          </span>
                          <span className="text-sm font-bold text-[#131b2e]">
                            {(parseFloat(reservation.subtotalUsdt) + parseFloat(reservation.platformFeeUsdt)).toFixed(2)} USDC
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <ShieldCheck size={20} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-[#131b2e] text-sm">Security deposit</h4>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                Later step
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              The deposit remains separate and will move into protected custody after the first payment is confirmed.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Deposit
                          </span>
                          <span className="text-sm font-bold text-[#131b2e]">
                            {parseFloat(reservation.securityDepositUsdt).toFixed(2)} USDC
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fcfefd_0%,#f8fafc_100%)] p-4">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-[18px] border border-emerald-100 bg-white/90 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle size={20} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-[#131b2e] text-sm">First payment</h4>
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                                Confirmed
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Rent and platform fee are complete. This payment intent is no longer pending.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Amount
                          </span>
                          <span className="text-sm font-bold text-[#131b2e]">
                            {(parseFloat(reservation.subtotalUsdt) + parseFloat(reservation.platformFeeUsdt)).toFixed(2)} USDC
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Reference
                          </span>
                          {intent.txHash ? (
                            <a
                              href={reservation.stellarExplorerBaseUrl.replace('/account/', '/tx/') + intent.txHash}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-[11px] inline-flex items-center gap-1 transition-colors"
                              title="View payment transfer on Stellar Expert"
                            >
                              Review on the network
                              <ExternalLink size={10} className="inline-block" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500">Simulated confirmation</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-emerald-100 bg-white/90 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <ShieldCheck size={20} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-[#131b2e] text-sm">Security deposit</h4>
                              <span
                                className={[
                                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                                  depositPaymentStatus.tone === 'success'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : depositPaymentStatus.tone === 'danger'
                                      ? 'bg-rose-100 text-rose-800'
                                      : depositPaymentStatus.tone === 'warning'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-600',
                                ].join(' ')}
                              >
                                {depositPaymentStatus.badge}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {depositPaymentStatus.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Deposit
                          </span>
                          <span className="text-sm font-bold text-[#131b2e]">
                            {parseFloat(reservation.securityDepositUsdt).toFixed(2)} USDC
                          </span>
                          {escrow?.contractAddress ? (
                            <>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Network
                              </span>
                              <a
                                href={reservation.stellarExplorerBaseUrl.replace('/account/', '/contract/') + escrow.contractAddress}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline text-[11px] inline-flex items-center gap-1 transition-colors"
                                title="View contract details on Stellar Expert"
                              >
                                Review on the network
                                <ExternalLink size={10} className="inline-block" />
                              </a>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Viewer
                              </span>
                              <a
                                href={`https://viewer.trustlesswork.com/${escrow.contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline text-[11px] inline-flex items-center gap-1 transition-colors"
                                title="View escrow contract details on Trustless Work Viewer"
                              >
                                Open Trustless Work
                                <ExternalLink size={10} className="inline-block" />
                              </a>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              Protected custody pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>
        )}

        <FundsMovementCard reservation={reservation} />

        {reservation.status === "completed" && (
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

        {reservation.status === "disputed" && (
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

      {/* Right side: Progress Guide */}
      <div className="lg:col-span-5">
        <Card className="ambient-lift border-none bg-white p-6 rounded-3xl lg:sticky lg:top-6">
          <Card.Content className="p-0 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-[#131b2e]">Reservation Progress</h3>
              <p className="text-slate-500 text-xs">
                This panel updates the current step as the payment and protected deposit move forward.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {paymentJourney.map((step, index) => {
                const isCurrent = step.state === 'current';
                const isComplete = step.state === 'complete';
                const isWarning = step.state === 'warning';
                const isExpanded = isCurrent || isWarning;
                const badgeClassName = isWarning
                  ? 'bg-amber-100 text-amber-800'
                  : isCurrent
                    ? 'bg-emerald-100 text-emerald-800'
                    : isComplete
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-slate-100 text-slate-500';
                const stepPanelClassName = isExpanded
                  ? isWarning
                    ? 'border-amber-200 bg-amber-50/80'
                    : 'border-emerald-200 bg-emerald-50/70'
                  : 'border-[#e8edf8] bg-[#fbfcff]';

                return (
                  <div
                    key={step.title}
                    className={[
                      'rounded-[22px] border px-4 py-3 transition-colors',
                      stepPanelClassName,
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                          isWarning
                            ? 'border-amber-300 bg-white text-amber-700'
                            : isCurrent
                              ? 'border-emerald-300 bg-white text-emerald-700'
                              : isComplete
                                ? 'border-slate-300 bg-white text-slate-700'
                                : 'border-slate-200 bg-white text-slate-400',
                        ].join(' ')}
                      >
                        {isComplete ? '✓' : index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-[#131b2e]">{step.title}</h4>
                                <p className="mt-0.5 text-xs text-slate-500">{step.summary}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isCurrent && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClassName}`}>Current</span>}
                                {isWarning && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClassName}`}>Attention</span>}
                                {isComplete && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeClassName}`}>Done</span>}
                                <ChevronDown
                                  size={16}
                                  className={[
                                    'shrink-0 text-slate-400 transition-transform',
                                    isExpanded ? 'rotate-180' : '',
                                  ].join(' ')}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 border-t border-black/5 pt-3">
                            <p className="text-xs leading-relaxed text-slate-700">{step.description}</p>

                            {step.title === 'Confirm first payment' && intent.status === 'pending' && (
                              <div className="mt-4 rounded-[20px] border border-emerald-200 bg-white/80 p-2">
                                <PaymentQRPanel
                                  paymentIntentId={intent.id}
                                  walletId={intent.wallet.id}
                                  walletPublicKey={intent.wallet.publicKey}
                                  amountUsdt={intent.amountUsdt}
                                  securityDepositUsdt={reservation.securityDepositUsdt}
                                  isMockMode={isMockMode}
                                  guestPublicKey={reservation.tenantPublicKey}
                                  platformPublicKey={reservation.platformPublicKey}
                                  stellarExplorerBaseUrl={reservation.stellarExplorerBaseUrl}
                                  hasSecretKey={reservation.hasSecretKey}
                                />
                              </div>
                            )}

                            {step.title === 'Secure deposit' && reservation.status === 'paid' && (
                              <div className="mt-4 rounded-[20px] border border-emerald-200 bg-white/80 p-2">
                                <DepositEscrowPanel
                                  reservationId={reservation.id}
                                  tenantPublicKey={reservation.tenantPublicKey}
                                  ownerPublicKey={reservation.ownerPublicKey}
                                  platformPublicKey={reservation.platformPublicKey}
                                  stellarExplorerBaseUrl={reservation.stellarExplorerBaseUrl}
                                  usdcIssuerPublicKey={reservation.usdcIssuerPublicKey}
                                  securityDepositUsdt={reservation.securityDepositUsdt}
                                  hasSecretKey={reservation.hasSecretKey}
                                  hasTrustlessApiKey={reservation.hasTrustlessApiKey}
                                  isTrustlessMockMode={isTrustlessMockMode}
                                  existingEscrow={escrow || null}
                                />
                              </div>
                            )}

                            {step.title === 'Stay active' &&
                              (reservation.status === 'escrowed' || reservation.status === 'active') && (
                                <div className="mt-4 flex flex-col gap-4 rounded-[20px] border border-emerald-200 bg-white/80 p-4">
                                  <div className="flex flex-col gap-1">
                                    <h5 className="text-sm font-bold text-[#131b2e]">Stay verification</h5>
                                    <p className="text-xs leading-relaxed text-slate-600">
                                      Start checkout from this step when the guest is ready to leave, or open a claim if the stay needs review.
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    {(roleContext.isTenant || roleContext.isAdmin) && (
                                      <Button
                                        onPress={handleRequestCheckout}
                                        variant="primary"
                                        isPending={isRequestingCheckout}
                                        className="font-bold bg-[#064e3b] text-white"
                                      >
                                        Checkout &amp; Claim Deposit
                                      </Button>
                                    )}

                                    {(roleContext.isOwner || roleContext.isAdmin) && (
                                      <Button
                                        onPress={() => setShowDisputeForm(!showDisputeForm)}
                                        variant="danger-soft"
                                        className="font-semibold"
                                      >
                                        <ShieldAlert size={15} /> Initiate Stay Dispute
                                      </Button>
                                    )}
                                  </div>

                                  <div className="text-xs leading-relaxed text-slate-500">
                                    {roleContext.isOwner && !roleContext.isAdmin && (
                                      <p>Host mode: await guest checkout, or open a claim if there is an active contract breach.</p>
                                    )}
                                    {roleContext.isTenant && !roleContext.isAdmin && (
                                      <p>Guest mode: the stay is active. When you are ready to leave, start checkout from here.</p>
                                    )}
                                  </div>

                                  {showDisputeForm && (roleContext.isOwner || roleContext.isAdmin) && (
                                    <form onSubmit={handleDisputeSubmit} className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                                      <div className="grid grid-cols-1 gap-4">
                                        <TextField className="w-full flex flex-col gap-1">
                                          <Label className="text-sm font-semibold text-slate-700">Claim Amount (USDC)</Label>
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
                                </div>
                              )}

                            {step.title === 'Checkout review' && reservation.status === 'checking_out' && (
                              <div className="mt-4 flex flex-col gap-4 rounded-[20px] border border-amber-200 bg-white/80 p-4">
                                {expirationDate && (
                                  <div className="rounded-2xl bg-[#fcf8e3] border border-[#faebcc] text-[#8a6d3b] p-4 flex items-center gap-3 text-xs">
                                    <Timer size={18} className="shrink-0 text-[#8a6d3b]" />
                                    <div className="flex-1">
                                      <span className="font-bold block">Review window active</span>
                                      <span className="mt-0.5 block leading-relaxed">
                                        The host has {disputeWindowHours} hours from checkout to inspect the listing.
                                        {isWindowExpired ? (
                                          <span className="font-bold text-red-600 block mt-1">Status: expired. The deposit can now be claimed.</span>
                                        ) : (
                                          <span className="font-bold block mt-1">Time remaining: {getRemainingTimeStr()}</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                  {!isWindowExpired && (roleContext.isOwner || roleContext.isAdmin) && (
                                    <Button
                                      onPress={handleCheckout}
                                      variant="primary"
                                      isPending={isCheckingOut}
                                      className="font-bold bg-[#064e3b] text-white"
                                    >
                                      Accept Checkout &amp; Release Deposit
                                    </Button>
                                  )}

                                  {isWindowExpired && (roleContext.isTenant || roleContext.isAdmin) && (
                                    <Button
                                      onPress={handleCheckout}
                                      variant="primary"
                                      isPending={isCheckingOut}
                                      className="font-bold bg-amber-600 text-white"
                                    >
                                      Claim Deposit (Review Window Expired)
                                    </Button>
                                  )}

                                  {!isWindowExpired && (roleContext.isOwner || roleContext.isAdmin) && (
                                    <Button
                                      onPress={() => setShowDisputeForm(!showDisputeForm)}
                                      variant="danger-soft"
                                      className="font-semibold"
                                    >
                                      <ShieldAlert size={15} /> Initiate Stay Dispute
                                    </Button>
                                  )}
                                </div>

                                <div className="text-xs leading-relaxed text-slate-500">
                                  {!isWindowExpired && roleContext.isTenant && !roleContext.isAdmin && (
                                    <p>Guest mode: checkout is complete on your side. Await host approval or review window expiration.</p>
                                  )}
                                  {isWindowExpired && roleContext.isOwner && !roleContext.isAdmin && (
                                    <p>Host mode: the review window has expired. The guest can now claim the deposit.</p>
                                  )}
                                </div>

                                {showDisputeForm && !isWindowExpired && (roleContext.isOwner || roleContext.isAdmin) && (
                                  <form onSubmit={handleDisputeSubmit} className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                                    <div className="grid grid-cols-1 gap-4">
                                      <TextField className="w-full flex flex-col gap-1">
                                        <Label className="text-sm font-semibold text-slate-700">Claim Amount (USDC)</Label>
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
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>

    {typeof document !== 'undefined' && isDepositDetailsOpen && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-8" onClick={() => setIsDepositDetailsOpen(false)}>
        <div
          className="w-full max-w-2xl rounded-[28px] border border-[#dfe6f5] bg-white shadow-[0_32px_80px_rgba(15,23,42,0.24)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-[#131b2e]">Deposit Protection Status</h3>
              <p className="text-sm text-slate-500">
                Review the protected deposit references and contract links for this reservation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDepositDetailsOpen(false)}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-6">
            {escrow ? (
              <div className="bg-[#f8f8ff] border border-[#eaedff] p-4 rounded-2xl flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Deposit Reference ID</span>
                  <span className="font-mono text-right text-slate-700 break-all">{escrow.trustlessEscrowId || 'None'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Secured Smart Account</span>
                  <div className="text-right">
                    {escrow.contractAddress ? (
                      <a
                        href={reservation.stellarExplorerBaseUrl.replace('/account/', '/contract/') + escrow.contractAddress}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#003527] font-semibold hover:underline inline-flex items-center gap-1"
                        title="View contract details on Stellar Expert"
                      >
                        {`${escrow.contractAddress.substring(0, 8)}...${escrow.contractAddress.slice(-8)}`}
                        <ExternalLink size={12} className="inline-block" />
                      </a>
                    ) : (
                      <span className="text-slate-700">N/A</span>
                    )}
                  </div>
                </div>
                {escrow.contractAddress && (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Contract History</span>
                      <a
                        href={reservation.stellarExplorerBaseUrl.replace('/account/', '/contract/') + escrow.contractAddress}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        title="View contract movements and payments on Stellar Expert"
                      >
                        View Contract Movements
                        <ExternalLink size={11} className="inline-block" />
                      </a>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Agreement Details</span>
                      <a
                        href={`https://viewer.trustlesswork.com/${escrow.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#003527] font-semibold hover:underline inline-flex items-center gap-1"
                        title="View escrow contract details on Trustless Work Viewer"
                      >
                        Open Trustless Work Viewer
                        <ExternalLink size={11} className="inline-block" />
                      </a>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Locked Deposit</span>
                  <span className="font-bold text-slate-800">{parseFloat(escrow.amountUsdt).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Deposit Status</span>
                  <Chip
                    size="sm"
                    color={
                      depositPaymentStatus.tone === 'success'
                        ? 'success'
                        : depositPaymentStatus.tone === 'danger'
                          ? 'danger'
                          : depositPaymentStatus.tone === 'warning'
                            ? 'warning'
                            : 'default'
                    }
                    variant="soft"
                  >
                    {depositPaymentStatus.badge.toUpperCase()}
                  </Chip>
                </div>
                {escrow.latestDispute?.resolutionDetails ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Review Outcome</span>
                    <span className="max-w-[60%] text-right text-slate-700">{escrow.latestDispute.resolutionDetails}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No protected deposit is available yet for this reservation.
              </p>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    </div>
  );
}
