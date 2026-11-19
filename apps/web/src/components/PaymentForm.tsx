'use client';

import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatLbp,
  formatUsd,
  roundCents,
  type Currency,
  type ExchangeRates,
  type PaymentMethod,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, describeError, newKey } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

export interface PaymentTarget {
  appointmentId?: string;
  clientPackageId?: string;
}

/**
 * Takes one payment against a visit or a package. LBP is converted at the current rate,
 * shown before saving, and the rate is stored with the payment.
 */
export function PaymentForm({
  target,
  dueUsd,
  onSaved,
  onCancel,
}: {
  target: PaymentTarget;
  dueUsd: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // One key per form, so a double click or a retry cannot record the payment twice
  const [idempotencyKey] = useState(newKey);
  const [rate, setRate] = useState<number | null | undefined>(undefined);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState(dueUsd.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ data: ExchangeRates }>('/exchange-rates')
      .then((r) => !cancelled && setRate(r.data.current?.lbpPerUsd ?? null))
      .catch(() => !cancelled && setRate(null));
    return () => {
      cancelled = true;
    };
  }, []);

  function pickCurrency(c: Currency) {
    setCurrency(c);
    // Offer the full amount due in the chosen currency; the person can change it
    setAmount(c === 'USD' ? dueUsd.toFixed(2) : rate ? String(Math.round(dueUsd * rate)) : '');
  }

  const numeric = Number(amount);
  const usdValue =
    currency === 'USD' ? numeric : rate && numeric > 0 ? roundCents(numeric / rate) : null;
  const overDue = usdValue !== null && usdValue > dueUsd + 0.05;

  async function submit(e: React.FormEvent) {
    // This form can sit inside a dialog that has its own form
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    if (!(numeric > 0)) return setError('Enter an amount above zero.');
    setSaving(true);
    try {
      await api('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...target, currency, amount: numeric, method }),
      });
      onSaved();
    } catch (err) {
      setError(describeError(err, 'Could not record the payment.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-stone-300 p-3">
      <p className="text-sm">
        Still due: <strong>{formatUsd(dueUsd)}</strong>
      </p>

      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Currency</legend>
        {(['USD', 'LBP'] as const).map((c) => (
          <label key={c} className="flex items-center gap-1.5">
            <input type="radio" name="currency" checked={currency === c} onChange={() => pickCurrency(c)} />
            {c === 'USD' ? 'US dollars' : 'Lebanese pounds'}
          </label>
        ))}
      </fieldset>

      {currency === 'LBP' && rate === null && (
        <p role="alert" className="text-sm text-amber-800">
          No exchange rate is set yet. <Link href="/rates" className="underline">Set the rate</Link> before taking LBP.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="pay-amount" className="text-sm font-medium">Amount ({currency})</label>
          <input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={field}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pay-method" className="text-sm font-medium">Method</label>
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={field}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </div>

      {currency === 'LBP' && rate && numeric > 0 && (
        <p className="text-sm text-stone-600" aria-live="polite">
          {formatLbp(numeric)} at {rate.toLocaleString('en-US')} = <strong>{formatUsd(usdValue ?? 0)}</strong>
        </p>
      )}
      {overDue && (
        <p role="alert" className="text-sm text-amber-800">
          That is more than the {formatUsd(dueUsd)} still due, so it will be refused.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving || (currency === 'LBP' && !rate)} className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Record payment'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
