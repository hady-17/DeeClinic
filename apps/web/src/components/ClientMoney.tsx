'use client';

import {
  formatUsd,
  roundCents,
  type ClientPackage,
  type PackageTemplate,
  type Payment,
} from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentList } from '@/components/PaymentList';
import { api, describeError, newKey } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { lastValidDay } from '@/lib/time';

const STATUS: Record<ClientPackage['status'], { label: string; style: string }> = {
  active: { label: 'Active', style: 'bg-emerald-100 text-emerald-900' },
  completed: { label: 'Completed', style: 'bg-stone-200 text-stone-800' },
  expired: { label: 'Expired', style: 'bg-red-100 text-red-900' },
  cancelled: { label: 'Cancelled', style: 'bg-stone-200 text-stone-800' },
};

/** A client's packages (with sessions left and what is owed) and their payments. */
export function ClientMoney({ clientId }: { clientId: string }) {
  const me = useMe();
  const tz = useClinicTz();
  const [packages, setPackages] = useState<ClientPackage[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selling, setSelling] = useState(false);
  const [payingFor, setPayingFor] = useState<ClientPackage | null>(null);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ data: ClientPackage[] }>(`/clients/${clientId}/packages`),
      api<{ data: Payment[] }>(`/payments?clientId=${clientId}`),
    ])
      .then(([p, pay]) => {
        if (cancelled) return;
        setPackages(p.data);
        setPayments(pay.data);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setPackages([]);
        setPayments([]);
        setError(describeError(e, 'Could not load packages and payments.'));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadKey]);

  const canSell = hasPermission(me, 'packages.sell');
  const canPay = hasPermission(me, 'payments.record');

  return (
    <div className="space-y-8">
      <section aria-label="Packages" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Packages</h2>
          {canSell && (
            <button type="button" onClick={() => setSelling(true)} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm">
              Sell a package
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {packages === null ? (
          <p className="text-stone-500">Loading…</p>
        ) : packages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            No packages.
          </p>
        ) : (
          <ul className="space-y-3">
            {packages.map((p) => {
              const due = roundCents(p.priceUsd - p.paidUsd);
              return (
                <li key={p.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-stone-600">
                        {p.serviceName} · valid until {lastValidDay(p.expiresAt, tz)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[p.status].style}`}>
                      {STATUS[p.status].label}
                    </span>
                  </div>

                  <div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-stone-200"
                      role="progressbar"
                      aria-label="Sessions used"
                      aria-valuemin={0}
                      aria-valuemax={p.sessionsTotal}
                      aria-valuenow={p.sessionsUsed}
                    >
                      <div className="h-full bg-stone-800" style={{ width: `${(p.sessionsUsed / p.sessionsTotal) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-sm">
                      <strong>{p.sessionsRemaining}</strong> of {p.sessionsTotal} sessions left
                      {p.status === 'active' && ` · ${p.sessionsAvailableToBook} not yet booked`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      Paid {formatUsd(p.paidUsd)} of {formatUsd(p.priceUsd)}
                      {due > 0.05 ? (
                        <span className="ml-2 font-medium text-amber-800">{formatUsd(due)} due</span>
                      ) : (
                        <span className="ml-2 text-emerald-800">paid in full</span>
                      )}
                    </span>
                    {canPay && due > 0.05 && p.status !== 'cancelled' && (
                      <button type="button" onClick={() => setPayingFor(p)} className="rounded-md border border-stone-300 px-2.5 py-1">
                        Add payment
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Payments" className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        {payments === null ? (
          <p className="text-stone-500">Loading…</p>
        ) : (
          <PaymentList payments={payments} canVoid={hasPermission(me, 'payments.void')} onChanged={reload} />
        )}
      </section>

      {selling && (
        <Modal title="Sell a package" onClose={() => setSelling(false)}>
          <SellForm
            clientId={clientId}
            onCancel={() => setSelling(false)}
            onSold={(pkg) => {
              setSelling(false);
              reload();
              // Most sales are paid at the desk, so offer the payment straight away
              if (canPay) setPayingFor(pkg);
            }}
          />
        </Modal>
      )}

      {payingFor && (
        <Modal title={`Payment for ${payingFor.name}`} onClose={() => setPayingFor(null)}>
          <PaymentForm
            target={{ clientPackageId: payingFor.id }}
            dueUsd={roundCents(payingFor.priceUsd - payingFor.paidUsd)}
            onCancel={() => setPayingFor(null)}
            onSaved={() => {
              setPayingFor(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SellForm({
  clientId,
  onSold,
  onCancel,
}: {
  clientId: string;
  onSold: (pkg: ClientPackage) => void;
  onCancel: () => void;
}) {
  const [idempotencyKey] = useState(newKey);
  const [templates, setTemplates] = useState<PackageTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: PackageTemplate[] }>('/package-templates')
      .then((r) => setTemplates(r.data))
      .catch((e) => {
        setTemplates([]);
        setError(describeError(e, 'Could not load the packages on offer.'));
      });
  }, []);

  const chosen = templates?.find((t) => t.id === templateId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!chosen) return setError('Choose a package.');
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ data: ClientPackage }>('/client-packages', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ clientId, templateId }),
      });
      onSold(r.data);
    } catch (err) {
      setError(describeError(err, 'Could not sell the package.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="tpl" className="text-sm font-medium">Package</label>
        <select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
          <option value="">{templates === null ? 'Loading…' : 'Choose a package'}</option>
          {templates?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.sessionCount} sessions · {formatUsd(t.priceUsd)}
            </option>
          ))}
        </select>
        {templates?.length === 0 && (
          <p className="text-sm text-amber-800">No packages are on offer yet. Add one under Packages.</p>
        )}
      </div>

      {chosen && (
        <p className="rounded-md bg-stone-50 p-3 text-sm">
          {chosen.sessionCount} sessions of {chosen.serviceName} for {formatUsd(chosen.priceUsd)}, valid for{' '}
          {chosen.validityDays} days from today. These terms are fixed once sold.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !chosen} className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {saving ? 'Selling…' : 'Sell package'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
