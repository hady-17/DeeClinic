'use client';

import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  formatUsd,
  type Service,
  type ServiceInput,
} from '@deeclinic/shared';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, ListSkeleton, PageHeader, Select } from '@/components/ui';
import { api, ApiError, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

export default function ServicesPage() {
  const me = useMe();
  const toast = useToast();
  const [services, setServices] = useState<Service[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const canEdit = hasPermission(me, 'services.write');

  useEffect(() => {
    let cancelled = false;
    api<{ data: Service[] }>(`/services?includeInactive=${showInactive}`)
      .then((r) => {
        if (cancelled) return;
        setServices(r.data);
        setError(null);
      })
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load services.')));
    return () => {
      cancelled = true;
    };
  }, [showInactive, reloadKey]);

  async function setActive(s: Service, isActive: boolean) {
    try {
      await api(`/services/${s.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      toast.show(isActive ? `${s.name} is offered again` : `${s.name} is no longer offered`);
      reload();
    } catch (e) {
      setError(describeError(e, 'Could not update the service.'));
    }
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="What the clinic offers, how long each takes, and what it costs. Deactivate a service to stop booking it without losing its history."
        actions={
          canEdit && (
            <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
              Add service
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Checkbox label="Show inactive services" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
      </div>

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      {services === null ? (
        <ListSkeleton rows={4} />
      ) : services.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No services yet"
          description="Add the treatments you offer so they can be booked."
          action={canEdit ? <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Add the first service</Button> : undefined}
        />
      ) : (
        <div className="mt-2 space-y-6">
          {SERVICE_CATEGORIES.map((cat) => {
            const items = services.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat} aria-label={SERVICE_CATEGORY_LABELS[cat]}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{SERVICE_CATEGORY_LABELS[cat]}</h2>
                <Card className="divide-y divide-line overflow-hidden">
                  {items.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className={s.isActive ? 'min-w-0' : 'min-w-0 opacity-60'}>
                        <p className="flex items-center gap-2 font-medium text-fg">
                          {s.name}
                          {!s.isActive && <Badge>Inactive</Badge>}
                        </p>
                        <p className="text-sm text-muted">
                          {s.durationMinutes} min · {formatUsd(s.priceUsd)}
                          {s.followUpIntervalDays ? ` · follow up after ${s.followUpIntervalDays} days` : ''}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setActive(s, !s.isActive)}>
                            {s.isActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New service' : 'Edit service'} onClose={() => setEditing(null)}>
          <ServiceForm
            service={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast.show(editing === 'new' ? 'Service added' : 'Service saved');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function ServiceForm({ service, onCancel, onSaved }: { service: Service | null; onCancel: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    const followUp = String(f.get('followUpIntervalDays')).trim();
    const body: ServiceInput = {
      name: String(f.get('name')),
      category: String(f.get('category')) as ServiceInput['category'],
      durationMinutes: Number(f.get('durationMinutes')),
      priceUsd: Number(f.get('priceUsd')),
      followUpIntervalDays: followUp === '' ? null : Number(followUp),
    };
    try {
      await api(service ? `/services/${service.id}` : '/services', {
        method: service ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(describeError(err, 'Could not save.'));
      }
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" required defaultValue={service?.name} data-autofocus />
      </Field>
      <Field label="Category" htmlFor="category" error={fieldErrors.category}>
        <Select id="category" name="category" defaultValue={service?.category ?? SERVICE_CATEGORIES[0]}>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SERVICE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (min)" htmlFor="durationMinutes" error={fieldErrors.durationMinutes}>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={service?.durationMinutes ?? 60} />
        </Field>
        <Field label="Price (USD)" htmlFor="priceUsd" error={fieldErrors.priceUsd}>
          <Input id="priceUsd" name="priceUsd" type="number" min={0} step="0.01" required defaultValue={service?.priceUsd} />
        </Field>
        <Field label="Follow up (days)" htmlFor="followUpIntervalDays" error={fieldErrors.followUpIntervalDays} hint="Optional">
          <Input id="followUpIntervalDays" name="followUpIntervalDays" type="number" min={1} placeholder="None" defaultValue={service?.followUpIntervalDays ?? ''} />
        </Field>
      </div>
      {formError && <Alert tone="bad">{formError}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : 'Save service'}
        </Button>
      </div>
    </form>
  );
}
