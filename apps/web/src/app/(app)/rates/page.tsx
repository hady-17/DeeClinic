'use client';

import type { ExchangeRates } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Alert, Button, Card, Field, Input, PageHeader, SectionHeading, Skeleton } from '@/components/ui';
import { api, ApiError, describeError } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { formatDateTime } from '@/lib/time';

export default function RatesPage() {
  const me = useMe();
  const tz = useClinicTz();
  const toast = useToast();
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [value, setValue] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      await api('/exchange-rates', {
        method: 'POST',
        body: JSON.stringify({ lbpPerUsd: Number(value.replace(/,/g, '')), confirmLargeChange }),
      });
      setValue('');
      setNeedsConfirm(null);
      toast.show('New exchange rate saved');
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Exchange rate"
        description="How many Lebanese pounds equal one US dollar. Payments in LBP are converted at the rate in effect when they are taken."
      />

      <Card className="mb-6 p-6" aria-live="polite">
        {rates === null ? (
          <Skeleton className="h-16 w-72" />
        ) : rates.current ? (
          <>
            <p className="text-sm font-medium text-muted">Current rate</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-fg">
              1 USD <span className="text-muted">=</span> {rates.current.lbpPerUsd.toLocaleString('en-US')} <span className="text-2xl text-muted">LBP</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              Set {formatDateTime(rates.current.effectiveFrom, tz)}
              {rates.current.setByName && ` by ${rates.current.setByName}`}
            </p>
          </>
        ) : (
          <Alert tone="warn">No rate is set yet. Payments in LBP cannot be taken until the first rate is entered.</Alert>
        )}
      </Card>

      {canWrite && (
        <Card className="mb-8 p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
            className="space-y-4"
          >
            <Field
              label="New rate (LBP per 1 USD)"
              htmlFor="rate"
              hint="Applies to payments recorded from now on. Payments already taken keep the rate they were taken at."
            >
              <Input
                id="rate"
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setNeedsConfirm(null);
                }}
                placeholder="89,500"
                required
                className="max-w-xs text-base"
              />
            </Field>

            {needsConfirm && (
              <Alert tone="warn">
                <p>{needsConfirm}</p>
                <Button size="sm" variant="primary" className="mt-3" loading={saving} onClick={() => save(true)}>
                  Yes, {value} is correct
                </Button>
              </Alert>
            )}
            {error && <Alert tone="bad">{error}</Alert>}

            {!needsConfirm && (
              <Button type="submit" variant="primary" loading={saving}>
                {saving ? 'Saving…' : 'Set new rate'}
              </Button>
            )}
          </form>
        </Card>
      )}

      <section className="space-y-3">
        <SectionHeading title="History" />
        {rates && rates.history.length === 0 ? (
          <p className="text-sm text-muted">No rates yet.</p>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {rates?.history.map((r, i) => (
              <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-fg">
                  {r.lbpPerUsd.toLocaleString('en-US')} LBP {i === 0 && <span className="ml-2 text-xs font-medium text-primary-ink">current</span>}
                </span>
                <span className="text-muted">
                  {formatDateTime(r.effectiveFrom, tz)}
                  {r.setByName && ` · ${r.setByName}`}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
