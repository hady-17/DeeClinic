'use client';

import { PAYMENT_METHOD_LABELS, formatLbp, formatUsd, type Payment } from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError, describeError } from '@/lib/api';
import { useClinicTz } from '@/lib/hooks';
import { formatDateTime } from '@/lib/time';

/** Payments with their rate, and a way to void one (with a reason). Nothing is ever deleted. */
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

  if (payments.length === 0) return <p className="text-sm text-stone-500">No payments yet.</p>;

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white text-sm">
        {payments.map((p) => (
          <li key={p.id} className={`space-y-1 p-3 ${p.voidedAt ? 'bg-stone-50 text-stone-500' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={p.voidedAt ? 'line-through' : 'font-medium'}>
                {p.currency === 'USD' ? formatUsd(p.amount) : `${formatLbp(p.amount)} (${formatUsd(p.amountUsd)})`}
              </span>
              <span className="text-xs">{formatDateTime(p.paidAt, tz)}</span>
            </div>
            <p className="text-xs text-stone-600">
              {showFor && `${p.forLabel} · `}
              {PAYMENT_METHOD_LABELS[p.method]}
              {p.exchangeRate && ` · rate ${p.exchangeRate.toLocaleString('en-US')}`}
            </p>
            {p.voidedAt && <p className="text-xs">Void: {p.voidReason}</p>}

            {canVoid && !p.voidedAt && voidingId !== p.id && (
              <button type="button" onClick={() => startVoid(p.id)} className="text-xs underline">
                Void
              </button>
            )}
            {voidingId === p.id && (
              <div className="space-y-2 rounded-md border border-stone-300 bg-white p-3">
                <p className="text-xs text-stone-600">
                  Voiding keeps this payment on record but stops it counting. Enter your passcode to confirm.
                </p>
                <div className="space-y-1">
                  <label htmlFor={`void-${p.id}`} className="text-xs font-medium">Reason</label>
                  <input
                    id={`void-${p.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is it being voided?"
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`pin-${p.id}`} className="text-xs font-medium">Your passcode</label>
                  <input
                    id={`pin-${p.id}`}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 digits"
                    className="w-32 rounded-md border border-stone-300 px-2 py-1 text-xs tracking-widest"
                  />
                </div>
                {needsPasscode && (
                  <p role="alert" className="text-xs text-amber-800">
                    You have not set a passcode yet.{' '}
                    <Link href="/account" className="underline">Set your passcode</Link>, then come back to void this payment.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || reason.trim().length < 3 || passcode.length !== 6}
                    onClick={() => confirmVoid(p.id)}
                    className="rounded-md bg-stone-900 px-2.5 py-1 text-xs text-white disabled:opacity-60"
                  >
                    {busy ? 'Voiding…' : 'Void payment'}
                  </button>
                  <button type="button" onClick={() => setVoidingId(null)} className="text-xs underline">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
