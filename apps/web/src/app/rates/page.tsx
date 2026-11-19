'use client';

import { formatDateTime } from '@/lib/time';
import type { ExchangeRates } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, describeError } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';

export default function RatesPage() {
  const me = useMe();
  const tz = useClinicTz();
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [value, setValue] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ data: ExchangeRates }>('/exchange-rates')
      .then((r) => !cancelled && setRates(r.data))
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load the rates.')));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function save(confirmLargeChange: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ lbpPerUsd: Number(value.replace(/,/g, '')), confirmLargeChange }),
      });
      setValue('');
      setNeedsConfirm(null);
      setSaved(true);
      setReloadKey((k) => k + 1);
    } catch (e) {
      const reason = e instanceof ApiError ? (e.details as { reason?: string } | undefined)?.reason : undefined;
      if (reason === 'RATE_CHANGE_NEEDS_CONFIRMATION') setNeedsConfirm(e instanceof Error ? e.message : '');
      else setError(describeError(e, 'Could not save the rate.'));
    } finally {
      setSaving(false);
    }
  }

  const canWrite = hasPermission(me, 'rates.write');

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exchange rate</h1>
        <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-6" aria-live="polite">
        {rates === null ? (
          <p className="text-stone-500">Loading…</p>
        ) : rates.current ? (
          <>
            <p className="text-sm text-stone-600">Current rate</p>
            <p className="text-3xl font-semibold">
              1 USD = {rates.current.lbpPerUsd.toLocaleString('en-US')} LBP
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Set {formatDateTime(rates.current.effectiveFrom, tz)}
              {rates.current.setByName && ` by ${rates.current.setByName}`}
            </p>
          </>
        ) : (
          <p className="text-amber-800">
            No rate is set yet. Payments in LBP cannot be taken until the first rate is entered.
          </p>
        )}
      </section>

      {canWrite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
          className="space-y-3 rounded-xl border border-stone-200 bg-white p-6"
        >
          <div className="space-y-1">
            <label htmlFor="rate" className="text-sm font-medium">New rate (LBP per 1 USD)</label>
            <input
              id="rate"
              inputMode="decimal"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setNeedsConfirm(null);
                setSaved(false);
              }}
              placeholder="89500"
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2"
            />
            <p className="text-xs text-stone-500">
              Applies to payments recorded from now on. Payments already taken keep the rate they were
              taken at.
            </p>
          </div>

          {needsConfirm && (
            <div role="alert" className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <p>{needsConfirm}</p>
              <button type="button" disabled={saving} onClick={() => save(true)} className="rounded-md bg-stone-900 px-3 py-1.5 text-white disabled:opacity-60">
                Yes, {value} is correct
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {saved && <p role="status" className="text-sm text-green-700">New rate saved.</p>}

          {!needsConfirm && (
            <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Set new rate'}
            </button>
          )}
        </form>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">History</h2>
        {rates && rates.history.length === 0 ? (
          <p className="text-sm text-stone-500">No rates yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
            {rates?.history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="font-medium">{r.lbpPerUsd.toLocaleString('en-US')} LBP</span>
                <span className="text-stone-600">
                  {formatDateTime(r.effectiveFrom, tz)}
                  {r.setByName && ` · ${r.setByName}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
