'use client';

import { formatUsd, roundCents, type Appointment, type Payment } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentList } from '@/components/PaymentList';
import { Alert, Badge, Button, Skeleton } from '@/components/ui';
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
      <section aria-label="Payment" className="space-y-2">
        <h3 className="text-sm font-semibold text-fg">Payment</h3>
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <Icon name="box" size={15} /> Covered by the client&apos;s package. Nothing to collect for this visit.
          </span>
        </Alert>
      </section>
    );
  }

  const paid = roundCents((payments ?? []).filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.amountUsd, 0));
  const due = roundCents(a.priceUsd - paid);
  const canRecord = hasPermission(me, 'payments.record') && a.status !== 'cancelled';

  return (
    <section aria-label="Payment" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Payment</h3>
        {canRecord && due > 0.05 && !adding && (
          <Button size="sm" icon="plus" onClick={() => setAdding(true)}>
            Add payment
          </Button>
        )}
      </div>

      {payments === null ? (
        <Skeleton className="h-6 w-56" />
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite">
          <span>
            Paid <strong className="text-fg">{formatUsd(paid)}</strong> of {formatUsd(a.priceUsd)}
          </span>
          {due > 0.05 ? <Badge tone="warn">{formatUsd(due)} due</Badge> : a.priceUsd > 0 && <Badge tone="ok">Paid in full</Badge>}
        </p>
      )}

      {error && <Alert tone="bad">{error}</Alert>}

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
