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
import { Alert, Button, Field, Input, Segmented, Select } from '@/components/ui';
import { api, describeError, newKey } from '@/lib/api';

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
  const usdValue = currency === 'USD' ? numeric : rate && numeric > 0 ? roundCents(numeric / rate) : null;
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
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-sunken/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Still due <strong className="ml-1 text-base text-fg">{formatUsd(dueUsd)}</strong>
        </p>
        <Segmented
          label="Currency"
          size="sm"
          value={currency}
          onChange={pickCurrency}
          options={[
            { value: 'USD', label: 'US dollars' },
            { value: 'LBP', label: 'Lebanese pounds' },
          ]}
        />
      </div>

      {currency === 'LBP' && rate === null && (
        <Alert tone="warn">
          No exchange rate is set yet.{' '}
          <Link href="/rates" className="font-medium underline">
            Set the rate
          </Link>{' '}
          before taking LBP.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Amount (${currency})`} htmlFor="pay-amount">
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus />
        </Field>
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {currency === 'LBP' && rate && numeric > 0 && (
        <p className="text-sm text-muted" aria-live="polite">
          {formatLbp(numeric)} at {rate.toLocaleString('en-US')} = <strong className="text-fg">{formatUsd(usdValue ?? 0)}</strong>
        </p>
      )}
      {overDue && <Alert tone="warn">That is more than the {formatUsd(dueUsd)} still due, so it will be refused.</Alert>}
      {error && <Alert tone="bad">{error}</Alert>}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving} disabled={currency === 'LBP' && !rate}>
          {saving ? 'Saving…' : 'Record payment'}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
