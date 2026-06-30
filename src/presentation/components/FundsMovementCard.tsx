import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';

type TimelineState = 'done' | 'current' | 'pending' | 'alert';

interface FundsMovementCardProps {
  reservation: {
    id: string;
    subtotalUsdt: string;
    securityDepositUsdt: string;
    platformFeeUsdt: string;
    status: string;
    tenantName: string;
    ownerName: string;
    tenantPublicKey: string;
    ownerPublicKey: string;
    platformPublicKey: string;
    stellarExplorerBaseUrl: string;
    paymentIntents: {
      id: string;
      amountUsdt: string;
      status: string;
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
}

interface FlowEndpoint {
  label: string;
  actor: string;
  tone: 'guest' | 'platform' | 'owner' | 'escrow' | 'intake' | 'neutral';
  address: string | null;
  href: string | null;
}

interface TimelineEvent {
  key: string;
  title: string;
  state: TimelineState;
  statusLabel: string;
  amountLabel: string;
  description: string;
  from: FlowEndpoint;
  to: FlowEndpoint;
  referenceLabel?: string;
  referenceValue?: string | null;
  txHash?: string | null;
  txHref?: string | null;
  relatedActors: string[];
}

function formatAmount(amount: number) {
  return `${amount.toFixed(2)} USDC`;
}

function shortenAddress(value: string | null) {
  if (!value) return 'Pending';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function accountHref(baseUrl: string, address: string | null) {
  if (!address) return null;
  return `${baseUrl}${address}`;
}

function contractHref(baseUrl: string, address: string | null) {
  if (!address) return null;
  return `${baseUrl.replace('/account/', '/contract/')}${address}`;
}

function transactionHref(baseUrl: string, txHash: string | null) {
  if (!txHash) return null;
  return `${baseUrl.replace('/account/', '/tx/')}${txHash}`;
}

function getToneClasses(tone: FlowEndpoint['tone']) {
  switch (tone) {
    case 'guest':
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        panel: 'border-emerald-100 bg-emerald-50/40',
        link: 'text-emerald-700 hover:text-emerald-800',
      };
    case 'platform':
      return {
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        panel: 'border-amber-100 bg-amber-50/50',
        link: 'text-amber-700 hover:text-amber-800',
      };
    case 'owner':
      return {
        badge: 'border-sky-200 bg-sky-50 text-sky-700',
        panel: 'border-sky-100 bg-sky-50/45',
        link: 'text-sky-700 hover:text-sky-800',
      };
    case 'escrow':
      return {
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        panel: 'border-rose-100 bg-rose-50/45',
        link: 'text-rose-700 hover:text-rose-800',
      };
    case 'intake':
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-700',
        panel: 'border-slate-200 bg-slate-50/75',
        link: 'text-slate-700 hover:text-slate-800',
      };
    default:
      return {
        badge: 'border-stone-200 bg-stone-50 text-stone-700',
        panel: 'border-stone-200 bg-stone-50/70',
        link: 'text-stone-700 hover:text-stone-800',
      };
  }
}

function getToneRoleLabel(tone: FlowEndpoint['tone']) {
  switch (tone) {
    case 'guest':
      return 'Guest';
    case 'platform':
      return 'Platform';
    case 'owner':
      return 'Owner';
    case 'escrow':
      return 'Escrow';
    case 'intake':
      return 'Intake';
    default:
      return 'Route';
  }
}

function getSettlementState(
  reservationStatus: string,
  escrowStatus: string | undefined,
  disputeStatus: string | undefined,
): TimelineState {
  if (reservationStatus === 'completed' || disputeStatus === 'resolved_to_owner' || disputeStatus === 'split_resolution') {
    return 'done';
  }

  if (reservationStatus === 'disputed' || escrowStatus === 'disputed') {
    return 'alert';
  }

  if (['checking_out', 'active', 'escrowed'].includes(reservationStatus)) {
    return 'current';
  }

  return 'pending';
}

function getDepositExitEvent(
  reservationStatus: string,
  escrowStatus: string | undefined,
  disputeStatus: string | undefined,
  depositAmountLabel: string,
  escrowEndpoint: FlowEndpoint,
  guestEndpoint: FlowEndpoint,
  ownerEndpoint: FlowEndpoint,
): TimelineEvent {
  if (disputeStatus === 'split_resolution') {
    return {
      key: 'deposit-outcome',
      title: 'Protected deposit resolution',
      state: 'done',
      statusLabel: 'Split',
      amountLabel: depositAmountLabel,
      description: 'The protected deposit was split between the guest and the host after review.',
      from: escrowEndpoint,
      to: {
        label: 'Guest + host',
        actor: 'Resolved payout',
        tone: 'neutral',
        address: null,
        href: null,
      },
      referenceLabel: 'Outcome',
      referenceValue: 'Split resolution',
      relatedActors: ['Guest', 'Owner'],
    };
  }

  if (escrowStatus === 'released' || disputeStatus === 'resolved_to_tenant') {
    return {
      key: 'deposit-outcome',
      title: 'Protected deposit release',
      state: 'done',
      statusLabel: 'Returned',
      amountLabel: depositAmountLabel,
      description: 'The protected deposit returned to the guest after checkout completed cleanly.',
      from: escrowEndpoint,
      to: guestEndpoint,
      referenceLabel: 'Outcome',
      referenceValue: 'Returned to guest',
      relatedActors: ['Guest'],
    };
  }

  if (disputeStatus === 'resolved_to_owner') {
    return {
      key: 'deposit-outcome',
      title: 'Protected deposit retention',
      state: 'done',
      statusLabel: 'Retained',
      amountLabel: depositAmountLabel,
      description: 'The protected deposit was awarded to the host after the review outcome.',
      from: escrowEndpoint,
      to: ownerEndpoint,
      referenceLabel: 'Outcome',
      referenceValue: 'Awarded to host',
      relatedActors: ['Owner'],
    };
  }

  if (reservationStatus === 'disputed' || escrowStatus === 'disputed') {
    return {
      key: 'deposit-outcome',
      title: 'Protected deposit review',
      state: 'alert',
      statusLabel: 'Under review',
      amountLabel: depositAmountLabel,
      description: 'The protected deposit is locked while the review outcome is being resolved.',
      from: escrowEndpoint,
      to: {
        label: 'Outcome pending',
        actor: 'Review in progress',
        tone: 'neutral',
        address: null,
        href: null,
      },
      referenceLabel: 'Outcome',
      referenceValue: 'Review pending',
      relatedActors: ['Guest', 'Owner'],
    };
  }

  if (['checking_out', 'active', 'escrowed'].includes(reservationStatus) || escrowStatus === 'funded') {
    return {
      key: 'deposit-outcome',
      title: 'Protected deposit release',
      state: 'current',
      statusLabel: 'Waiting for checkout',
      amountLabel: depositAmountLabel,
      description: 'The protected deposit is in custody and will route to the correct party when checkout settles.',
      from: escrowEndpoint,
      to: {
        label: 'Guest or host',
        actor: 'Checkout outcome',
        tone: 'neutral',
        address: null,
        href: null,
      },
      referenceLabel: 'Outcome',
      referenceValue: 'Depends on checkout review',
      relatedActors: ['Guest', 'Owner'],
    };
  }

  return {
    key: 'deposit-outcome',
    title: 'Protected deposit release',
    state: 'pending',
    statusLabel: 'Not started',
    amountLabel: depositAmountLabel,
    description: 'This transfer becomes available once the protected deposit has been funded.',
    from: escrowEndpoint,
    to: {
      label: 'Guest or host',
      actor: 'Checkout outcome',
      tone: 'neutral',
      address: null,
      href: null,
    },
    referenceLabel: 'Outcome',
    referenceValue: 'Pending funding',
    relatedActors: ['Guest', 'Owner'],
  };
}

export function FundsMovementCard({ reservation }: FundsMovementCardProps) {
  const intent = reservation.paymentIntents[0];
  const escrow = reservation.escrows[0];
  const subtotal = Number.parseFloat(reservation.subtotalUsdt || '0');
  const platformFee = Number.parseFloat(reservation.platformFeeUsdt || '0');
  const depositAmount = Number.parseFloat(reservation.securityDepositUsdt || '0');
  const firstPaymentAmount = subtotal + platformFee;
  const firstPaymentAmountLabel = formatAmount(firstPaymentAmount);
  const subtotalAmountLabel = formatAmount(subtotal);
  const platformFeeAmountLabel = formatAmount(platformFee);
  const depositAmountLabel = formatAmount(depositAmount);
  const paymentConfirmed = intent?.status === 'paid';
  const intentTxHref = transactionHref(reservation.stellarExplorerBaseUrl, intent?.txHash || null);

  const guestEndpoint: FlowEndpoint = {
    label: 'Guest account',
    actor: reservation.tenantName || 'Guest user',
    tone: 'guest',
    address: reservation.tenantPublicKey || null,
    href: accountHref(reservation.stellarExplorerBaseUrl, reservation.tenantPublicKey || null),
  };

  const intakeEndpoint: FlowEndpoint = {
    label: 'Reservation intake account',
    actor: 'Intake',
    tone: 'intake',
    address: intent?.wallet.publicKey || null,
    href: accountHref(reservation.stellarExplorerBaseUrl, intent?.wallet.publicKey || null),
  };

  const platformEndpoint: FlowEndpoint = {
    label: 'Vytrosti treasury',
    actor: 'Platform',
    tone: 'platform',
    address: reservation.platformPublicKey || null,
    href: accountHref(reservation.stellarExplorerBaseUrl, reservation.platformPublicKey || null),
  };

  const ownerEndpoint: FlowEndpoint = {
    label: 'Host account',
    actor: reservation.ownerName || 'Owner user',
    tone: 'owner',
    address: reservation.ownerPublicKey || null,
    href: accountHref(reservation.stellarExplorerBaseUrl, reservation.ownerPublicKey || null),
  };

  const escrowEndpoint: FlowEndpoint = {
    label: 'Protected deposit account',
    actor: 'Escrow',
    tone: 'escrow',
    address: escrow?.contractAddress || null,
    href: contractHref(reservation.stellarExplorerBaseUrl, escrow?.contractAddress || null),
  };

  const events: TimelineEvent[] = [
    {
      key: 'guest-to-intake',
      title: 'First payment intake',
      state: paymentConfirmed ? 'done' : 'current',
      statusLabel: paymentConfirmed ? 'Confirmed' : 'Waiting for transfer',
      amountLabel: firstPaymentAmountLabel,
      description: 'The guest sends rent plus platform fee to the assigned intake account for this reservation.',
      from: guestEndpoint,
      to: intakeEndpoint,
      referenceLabel: 'Reference',
      referenceValue: intent?.txHash || intent?.id || null,
      txHash: intent?.txHash || null,
      txHref: intentTxHref,
      relatedActors: ['Guest', 'Platform'],
    },
    {
      key: 'intake-to-platform',
      title: 'Platform allocation',
      state: paymentConfirmed ? 'done' : 'pending',
      statusLabel: paymentConfirmed ? 'Captured' : 'Waiting for intake',
      amountLabel: `${subtotalAmountLabel} rent + ${platformFeeAmountLabel} fee`,
      description: 'Once the intake account confirms the transfer, Vytrosti captures the reservation amount and records the fee.',
      from: intakeEndpoint,
      to: platformEndpoint,
      referenceLabel: 'Reference',
      referenceValue: paymentConfirmed ? intent?.txHash || 'Captured in platform flow' : 'Pending first transfer',
      txHash: intent?.txHash || null,
      txHref: intentTxHref,
      relatedActors: ['Platform', 'Owner'],
    },
    {
      key: 'guest-to-escrow',
      title: 'Protected deposit funding',
      state:
        escrow && ['funded', 'released', 'resolved', 'disputed'].includes(escrow.status)
          ? 'done'
          : reservation.status === 'paid'
            ? 'current'
            : 'pending',
      statusLabel:
        escrow && ['funded', 'released', 'resolved', 'disputed'].includes(escrow.status)
          ? 'Protected'
          : reservation.status === 'paid'
            ? 'Next step'
            : 'Waiting for first payment',
      amountLabel: depositAmountLabel,
      description: 'The guest funds the protected deposit separately, directly into the Trustless Work custody account.',
      from: guestEndpoint,
      to: escrowEndpoint,
      referenceLabel: 'Reference',
      referenceValue: escrow?.trustlessEscrowId || escrow?.contractAddress || 'Pending protected funding',
      relatedActors: ['Guest', 'Owner'],
    },
    {
      key: 'platform-to-owner',
      title: 'Host payout',
      state: getSettlementState(reservation.status, escrow?.status, escrow?.latestDispute?.status),
      statusLabel:
        reservation.status === 'completed'
          ? 'Released'
          : reservation.status === 'disputed'
            ? 'Paused by review'
            : ['checking_out', 'active', 'escrowed'].includes(reservation.status)
              ? 'Queued for checkout'
              : 'Waiting for stay progress',
      amountLabel: subtotalAmountLabel,
      description:
        reservation.status === 'completed'
          ? 'The stay settled and the host payout has been released from the platform side.'
          : reservation.status === 'disputed'
            ? 'The host payout is paused until the protected deposit review reaches an outcome.'
            : 'The host payout is scheduled to settle after checkout completes.',
      from: platformEndpoint,
      to: ownerEndpoint,
      referenceLabel: 'Route',
      referenceValue: reservation.status === 'completed' ? 'Checkout settled' : 'Checkout pending',
      relatedActors: ['Platform', 'Owner'],
    },
    getDepositExitEvent(
      reservation.status,
      escrow?.status,
      escrow?.latestDispute?.status,
      depositAmountLabel,
      escrowEndpoint,
      guestEndpoint,
      ownerEndpoint,
    ),
  ];
  const completedEvents = events.filter((event) => event.state === 'done');

  return (
    <section className="funds-trace-card ambient-lift rounded-[28px] p-5 md:p-6" aria-labelledby="funds-trace-title">
      <div className="funds-trace-card__grid" />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="funds-trace-card__eyebrow">funds_trace.ts</span>
            <div>
              <h3 id="funds-trace-title" className="text-lg font-black tracking-tight text-[#131b2e]">
                Money route
              </h3>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                A developer-style trace that only lists completed money movements between the guest, Vytrosti, the host, and protected custody.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d9def4] bg-white/75 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Reservation</span>
            <span className="block font-mono text-xs text-slate-700">#{reservation.id.slice(0, 8)}</span>
          </div>
        </div>

        {completedEvents.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-amber-200 bg-white/80 px-4 py-5 text-sm text-slate-600">
            No completed money movements yet. Confirm the first payment to start the trace.
          </div>
        ) : (
        <ol className="flex flex-col gap-3">
          {completedEvents.map((event, index) => (
            <li key={event.key} className="funds-trace-card__event">
              <div
                className={[
                  'funds-trace-card__event-marker',
                  'funds-trace-card__event-marker--done',
                ].join(' ')}
                aria-hidden="true"
              >
                {index + 1}
              </div>

              <div className="min-w-0 flex-1 rounded-[24px] border border-[#dfe5f4] bg-white/88 p-4 shadow-[0_18px_48px_-40px_rgba(19,27,46,0.45)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[#131b2e]">{event.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{event.description}</p>
                  </div>

                  <div className="rounded-2xl border border-[#e8edf8] bg-[#f8fbff] px-3 py-2 text-left lg:min-w-[180px] lg:text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Amount</span>
                    <span className="block font-mono text-xs font-semibold text-slate-700">{event.amountLabel}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                  <div
                    className={[
                      'rounded-2xl border px-3 py-3',
                      getToneClasses(event.from.tone).panel,
                    ].join(' ')}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">From</span>
                    <span
                      className={[
                        'mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                        getToneClasses(event.from.tone).badge,
                      ].join(' ')}
                    >
                      {getToneRoleLabel(event.from.tone)}
                    </span>
                    <span className="mt-2 block text-sm font-bold text-[#131b2e]">{event.from.actor}</span>
                    <span className="block text-[11px] text-slate-500">{event.from.label}</span>
                    {event.from.href && event.from.address ? (
                      <a
                        href={event.from.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={[
                          'mt-2 inline-flex items-center gap-1 font-mono text-[11px] transition-colors hover:underline',
                          getToneClasses(event.from.tone).link,
                        ].join(' ')}
                      >
                        {shortenAddress(event.from.address)}
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="mt-2 block font-mono text-[11px] text-slate-400">Dynamic route</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center text-slate-300">
                    <ArrowRight size={18} />
                  </div>

                  <div
                    className={[
                      'rounded-2xl border px-3 py-3',
                      getToneClasses(event.to.tone).panel,
                    ].join(' ')}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">To</span>
                    <span
                      className={[
                        'mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                        getToneClasses(event.to.tone).badge,
                      ].join(' ')}
                    >
                      {getToneRoleLabel(event.to.tone)}
                    </span>
                    <span className="mt-2 block text-sm font-bold text-[#131b2e]">{event.to.actor}</span>
                    <span className="block text-[11px] text-slate-500">{event.to.label}</span>
                    {event.to.href && event.to.address ? (
                      <a
                        href={event.to.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={[
                          'mt-2 inline-flex items-center gap-1 font-mono text-[11px] transition-colors hover:underline',
                          getToneClasses(event.to.tone).link,
                        ].join(' ')}
                      >
                        {shortenAddress(event.to.address)}
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="mt-2 block font-mono text-[11px] text-slate-400">Dynamic route</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.relatedActors.map((actor) => (
                      <span
                        key={`${event.key}-${actor}`}
                        className="rounded-full border border-[#d8def2] bg-[#f7f8fe] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
                      >
                        {actor}
                      </span>
                    ))}
                  </div>

                  {event.referenceLabel ? (
                    <div className="text-left md:text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        {event.referenceLabel}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-600">
                        {event.referenceValue || 'Pending'}
                      </span>
                      {event.txHref && event.txHash ? (
                        <a
                          href={event.txHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-amber-700 transition-colors hover:text-amber-800 hover:underline"
                        >
                          Open payment link
                          <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
        )}
      </div>
    </section>
  );
}
