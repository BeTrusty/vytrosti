'use client';

import { Button, Card } from '@heroui/react';

export default function ReservationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-6 py-16">
      <Card className="ambient-lift w-full border-none bg-white p-8 rounded-3xl">
        <Card.Content className="flex flex-col gap-4 p-0">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Reservation View
            </p>
            <h2 className="text-2xl font-bold text-[#131b2e]">
              We could not refresh this reservation right now.
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              The reservation action may have completed, but the follow-up refresh did not finish cleanly.
              Please retry the view once before taking another payment or deposit step.
            </p>
          </div>

          {error.message ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {error.message}
            </p>
          ) : null}

          <div className="pt-2">
            <Button onPress={reset} className="bg-[#064e3b] text-white font-semibold">
              Retry Reservation Refresh
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
