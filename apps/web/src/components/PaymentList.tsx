'use client';

import { PAYMENT_METHOD_LABELS, formatLbp, formatUsd, type Payment } from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, cn } from '@/components/ui';
import { api, ApiError, describeError } from '@/lib/api';
import { useClinicTz } from '@/lib/hooks';
import { formatDateTime } from '@/lib/time';

/** Payments with their rate, and a way to void one (reason plus the person's passcode). Nothing is ever deleted. */
export function PaymentList({
  payments,
  canVoid,
  showFor = true,
  onChanged,
}: {
  payments: Payment[];
  canVoid: boolean;
  showFor?: boolean;
  onChanged: () => void;
}) {
  const tz = useClinicTz();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [passcode, setPasscode] = useState('');
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startVoid(id: string) {
    setVoidingId(id);
    setReason('');
    setPasscode('');
    setNeedsPasscode(false);
    setError(null);
  }

  async function confirmVoid(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/payments/${id}/void`, { method: 'POST', body: JSON.stringify({ reason, passcode }) });
      setVoidingId(null);
      setReason('');
      setPasscode('');
      onChanged();
    } catch (e) {
      setPasscode('');
      if (e instanceof ApiError && (e.details as { reason?: string } | undefined)?.reason === 'PASSCODE_NOT_SET') {
        setNeedsPasscode(true);
      } else {
        setError(describeError(e, 'Could not void the payment.'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (payments.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">No payments yet.</p>;
  }

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {payments.map((p) => (
        <div key={p.id} className={cn('space-y-1.5 p-3.5 text-sm', p.voidedAt && 'bg-sunken/60')}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className={cn('font-semibold', p.voidedAt ? 'text-muted line-through' : 'text-fg')}>
              {p.currency === 'USD' ? formatUsd(p.amount) : formatLbp(p.amount)}
              {p.currency === 'LBP' && <span className="ml-2 font-normal text-muted">= {formatUsd(p.amountUsd)}</span>}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted">
              {p.voidedAt && <Badge tone="bad">Void</Badge>}
              <span>{formatDateTime(p.paidAt, tz)}</span>
            </div>
          </div>
          <p className="text-xs text-muted">
            {showFor && `${p.forLabel} · `}
            {PAYMENT_METHOD_LABELS[p.method]}
            {p.exchangeRate && ` · rate ${p.exchangeRate.toLocaleString('en-US')}`}
          </p>
          {p.voidedAt && <p className="text-xs text-bad-ink">Reason: {p.voidReason}</p>}

          {canVoid && !p.voidedAt && voidingId !== p.id && (
            <button type="button" onClick={() => startVoid(p.id)} className="text-xs font-medium text-muted underline-offset-2 hover:text-bad-ink hover:underline">
              Void this payment
            </button>
          )}

          {voidingId === p.id && (
            <div className="mt-2 space-y-3 rounded-lg border border-line-strong bg-surface p-3">
              <p className="text-xs text-muted">
                Voiding keeps this payment on record but stops it counting. Enter your passcode to confirm.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <Field label="Reason" htmlFor={`void-${p.id}`}>
                  <Input id={`void-${p.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it being voided?" data-autofocus />
                </Field>
                <Field label="Your passcode" htmlFor={`pin-${p.id}`}>
                  <Input
                    id={`pin-${p.id}`}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 digits"
                    className="tracking-widest"
                  />
                </Field>
              </div>
              {needsPasscode && (
                <Alert tone="warn">
                  You have not set a passcode yet.{' '}
                  <Link href="/account" className="font-medium underline">
                    Set your passcode
                  </Link>
                  , then come back to void this payment.
                </Alert>
              )}
              {error && <Alert tone="bad">{error}</Alert>}
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={busy} disabled={reason.trim().length < 3 || passcode.length !== 6} onClick={() => confirmVoid(p.id)}>
                  {busy ? 'Voiding…' : 'Void payment'}
                </Button>
                <Button size="sm" onClick={() => setVoidingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
