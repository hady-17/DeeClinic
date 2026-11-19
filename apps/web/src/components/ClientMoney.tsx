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
import { useToast } from '@/components/Toast';
import { Alert, Badge, Button, Card, EmptyState, Field, ListSkeleton, SectionHeading, Select, type Tone } from '@/components/ui';
import { api, describeError, newKey } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { lastValidDay } from '@/lib/time';

const STATUS: Record<ClientPackage['status'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'ok' },
  completed: { label: 'Completed', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** A client's packages (with sessions left and what is owed) and their payments. */
export function ClientMoney({ clientId }: { clientId: string }) {
  const me = useMe();
  const tz = useClinicTz();
  const toast = useToast();
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
    <div className="space-y-10">
      <section aria-label="Packages" className="space-y-4">
        <SectionHeading
          title="Packages"
          action={
            canSell && (
              <Button size="sm" icon="plus" onClick={() => setSelling(true)}>
                Sell a package
              </Button>
            )
          }
        />

        {error && <Alert tone="bad">{error}</Alert>}

        {packages === null ? (
          <ListSkeleton rows={2} />
        ) : packages.length === 0 ? (
          <EmptyState icon="box" title="No packages" description="Sell a multi-session package and its sessions will be tracked here." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {packages.map((p) => {
              const due = roundCents(p.priceUsd - p.paidUsd);
              const used = (p.sessionsUsed / p.sessionsTotal) * 100;
              return (
                <li key={p.id}>
                  <Card className="h-full space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg">{p.name}</p>
                        <p className="text-sm text-muted">
                          {p.serviceName} · valid until {lastValidDay(p.expiresAt, tz)}
                        </p>
                      </div>
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span>
                          <strong className="text-2xl font-semibold text-fg">{p.sessionsRemaining}</strong>
                          <span className="text-muted"> of {p.sessionsTotal} sessions left</span>
                        </span>
                        {p.status === 'active' && <span className="text-xs text-muted">{p.sessionsAvailableToBook} not yet booked</span>}
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-sunken"
                        role="progressbar"
                        aria-label="Sessions used"
                        aria-valuemin={0}
                        aria-valuemax={p.sessionsTotal}
                        aria-valuenow={p.sessionsUsed}
                      >
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${used}%` }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                      <span className="text-muted">
                        Paid <strong className="text-fg">{formatUsd(p.paidUsd)}</strong> of {formatUsd(p.priceUsd)}
                      </span>
                      {due > 0.05 ? (
                        <span className="flex items-center gap-2">
                          <Badge tone="warn">{formatUsd(due)} due</Badge>
                          {canPay && p.status !== 'cancelled' && (
                            <Button size="sm" onClick={() => setPayingFor(p)}>
                              Add payment
                            </Button>
                          )}
                        </span>
                      ) : (
                        <Badge tone="ok">Paid in full</Badge>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Payments" className="space-y-4">
        <SectionHeading title="Payments" />
        {payments === null ? (
          <ListSkeleton rows={2} />
        ) : (
          <PaymentList payments={payments} canVoid={hasPermission(me, 'payments.void')} onChanged={reload} />
        )}
      </section>

      {selling && (
        <Modal title="Sell a package" description="The terms are copied at the moment of sale." onClose={() => setSelling(false)}>
          <SellForm
            clientId={clientId}
            onCancel={() => setSelling(false)}
            onSold={(pkg) => {
              setSelling(false);
              reload();
              toast.show('Package sold');
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
              toast.show('Payment recorded');
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
    <form onSubmit={submit} className="space-y-5">
      <Field label="Package" htmlFor="tpl">
        <Select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)} data-autofocus>
          <option value="">{templates === null ? 'Loading…' : 'Choose a package'}</option>
          {templates?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.sessionCount} sessions · {formatUsd(t.priceUsd)}
            </option>
          ))}
        </Select>
        {templates?.length === 0 && <p className="mt-1.5 text-sm text-warn-ink">No packages are on offer yet. Add one under Packages.</p>}
      </Field>

      {chosen && (
        <Alert tone="info">
          {chosen.sessionCount} sessions of {chosen.serviceName} for {formatUsd(chosen.priceUsd)}, valid for {chosen.validityDays} days from today.
          These terms are fixed once sold.
        </Alert>
      )}

      {error && <Alert tone="bad">{error}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!chosen}>
          {saving ? 'Selling…' : 'Sell package'}
        </Button>
      </div>
    </form>
  );
}
