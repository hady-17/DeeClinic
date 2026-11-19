'use client';

import { formatUsd, roundCents, type Appointment, type Payment } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentList } from '@/components/PaymentList';
import { api, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

/** What a visit costs, what has been paid, and a way to take a payment. */
export function AppointmentPayments({ appointment: a }: { appointment: Appointment }) {
  const me = useMe();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const coveredByPackage = Boolean(a.clientPackageId);

  useEffect(() => {
    if (coveredByPackage) return;
    let cancelled = false;
    api<{ data: Payment[] }>(`/payments?appointmentId=${a.id}`)
      .then((r) => !cancelled && setPayments(r.data))
      .catch((e) => {
        if (cancelled) return;
        setPayments([]);
        setError(describeError(e, 'Could not load payments.'));
      });
    return () => {
      cancelled = true;
    };
  }, [a.id, coveredByPackage, reloadKey]);

  if (coveredByPackage) {
    return (
      <section aria-label="Payment" className="space-y-1">
        <h3 className="text-sm font-semibold">Payment</h3>
        <p className="text-sm text-stone-600">Covered by the client&apos;s package. Nothing to collect for this visit.</p>
      </section>
    );
  }

  const paid = roundCents((payments ?? []).filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.amountUsd, 0));
  const due = roundCents(a.priceUsd - paid);
  const canRecord = hasPermission(me, 'payments.record') && a.status !== 'cancelled';

  return (
    <section aria-label="Payment" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Payment</h3>
        {canRecord && due > 0.05 && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-sm underline">
            Add payment
          </button>
        )}
      </div>

      {payments !== null && (
        <p className="text-sm" aria-live="polite">
          Paid {formatUsd(paid)} of {formatUsd(a.priceUsd)}
          {due > 0.05 ? (
            <span className="ml-2 font-medium text-amber-800">{formatUsd(due)} due</span>
          ) : (
            a.priceUsd > 0 && <span className="ml-2 text-emerald-800">paid in full</span>
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {adding && (
        <PaymentForm
          target={{ appointmentId: a.id }}
          dueUsd={due}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {payments && payments.length > 0 && (
        <PaymentList
          payments={payments}
          canVoid={hasPermission(me, 'payments.void')}
          showFor={false}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </section>
  );
}
