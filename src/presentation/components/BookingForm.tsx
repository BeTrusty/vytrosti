'use client';

import React, { useState, useMemo } from 'react';
import { Button, Input, Card, Alert, TextField, Label } from '@heroui/react';
import { createBooking } from '@/application/actions/booking';
import { ShieldCheck, Calculator, ArrowRight, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/infrastructure/auth/client';

interface BookingFormProps {
  listingId: string;
  pricePerNightUsdt: string;
  securityDepositUsdt: string;
}

export function BookingForm({ listingId, pricePerNightUsdt, securityDepositUsdt }: BookingFormProps) {
  const router = useRouter();
  const session = authClient.useSession();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!session.data;
  const isSessionPending = session.isPending;
  const isAdminUser = session.data?.user?.role === 'admin';

  const priceNum = parseFloat(pricePerNightUsdt);
  const depositNum = parseFloat(securityDepositUsdt);

  // Auto-calculation of nights and fees
  const pricingBreakdown = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 <= d1) return null;

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const rentSubtotal = priceNum * nights;
    const platformFee = rentSubtotal * 0.05; // 5% fee
    const firstPayment = rentSubtotal + platformFee;
    const totalCommitment = firstPayment + depositNum;

    return {
      nights,
      rentSubtotal,
      platformFee,
      firstPayment,
      deposit: depositNum,
      totalCommitment,
    };
  }, [checkIn, checkOut, priceNum, depositNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminUser) {
      setError('Admin accounts cannot request reservations. Switch to a guest account to continue.');
      return;
    }

    if (!checkIn || !checkOut) {
      setError('Please fill in all details');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createBooking({
      listingId,
      checkInStr: checkIn,
      checkOutStr: checkOut,
    });

    setLoading(false);
    if (res.success && res.reservationId) {
      router.push(`/reservations/${res.reservationId}`);
    } else {
      setError(res.error || 'Failed to create booking');
    }
  };

  return (
    <Card className="glass-panel border-none bg-white p-6 rounded-3xl">
      <Card.Content className="p-0 flex flex-col gap-6">
        <div>
          <h3 className="text-xl font-bold text-[#131b2e] flex items-center gap-2">
            <Calculator className="text-[#064e3b]" size={20} /> Reserve Property
          </h3>
          <p className="text-slate-500 text-xs mt-1">Specify dates to request reservation details.</p>
        </div>

        {error && (
          <Alert status="danger" title="Error">
            <Alert.Description>{error}</Alert.Description>
          </Alert>
        )}

        {isAdminUser && (
          <Alert status="warning" title="Reservations Unavailable">
            <Alert.Description>
              Admin accounts cannot request reservations. Sign in with a guest account to continue.
            </Alert.Description>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <TextField className="w-full flex flex-col gap-1">
              <Label className="text-sm font-semibold text-slate-700">Check-In</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                disabled={isAdminUser}
                required
                className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl px-3 py-2 w-full text-sm"
              />
            </TextField>
            <TextField className="w-full flex flex-col gap-1">
              <Label className="text-sm font-semibold text-slate-700">Check-Out</Label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                disabled={isAdminUser}
                required
                className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl px-3 py-2 w-full text-sm"
              />
            </TextField>
          </div>

          {pricingBreakdown && (
            <div className="bg-[#f2f3ff] border border-[#eaedff] rounded-2xl p-4 flex flex-col gap-3 text-sm">
              <span className="font-semibold text-slate-700 border-b border-[#eaedff] pb-1.5 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#064e3b]" /> Cost Summary ({pricingBreakdown.nights} nights)
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500">Rent Subtotal</span>
                <span className="text-slate-800">{pricingBreakdown.rentSubtotal.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Security Deposit (Refundable)</span>
                <span className="text-slate-800">{pricingBreakdown.deposit.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Platform Fee (5%)</span>
                <span className="text-slate-800">{pricingBreakdown.platformFee.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between border-t border-[#eaedff] pt-2 font-bold text-[#131b2e] text-base">
                <span>First Payment</span>
                <span className="text-[#064e3b]">{pricingBreakdown.firstPayment.toFixed(2)} USDC</span>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-500 leading-relaxed">
                Deposit shown for reference only. It is secured separately in escrow and is not included in the first payment.
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Total Commitment</span>
                <span>{pricingBreakdown.totalCommitment.toFixed(2)} USDC</span>
              </div>
            </div>
          )}

          {isSessionPending ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              isPending={true}
              className="w-full font-bold bg-slate-200 text-slate-500 flex items-center justify-center gap-1.5 rounded-xl"
            >
              Checking Auth Status...
            </Button>
          ) : !isAuthenticated ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => router.push(`/login?callbackUrl=/listings/${listingId}`)}
              className="w-full font-bold bg-[#003527] hover:bg-[#064e3b] text-white flex items-center justify-center gap-1.5 rounded-xl h-11"
            >
              <LogIn size={18} /> Sign In to Request Reservation
            </Button>
          ) : isAdminUser ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              isDisabled={true}
              className="w-full font-bold bg-slate-200 text-slate-500 flex items-center justify-center gap-1.5 rounded-xl h-11"
            >
              Reservation Disabled for Admin
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isPending={loading}
              className="w-full font-bold bg-[#064e3b] text-white flex items-center justify-center gap-1.5 rounded-xl"
            >
              Request Reservation <ArrowRight size={18} />
            </Button>
          )}
        </form>
      </Card.Content>
    </Card>
  );
}
