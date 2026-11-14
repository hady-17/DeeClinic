'use client';

import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  type Service,
  type ServiceInput,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type Editing = Service | 'new' | null;

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(async () => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    api<{ data: Service[] }>(`/services?includeInactive=${showInactive}`)
      .then((r) => {
        if (cancelled) return;
        setServices(r.data);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load services.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [showInactive, reloadKey]);

  async function setActive(s: Service, isActive: boolean) {
    try {
      await api(`/services/${s.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the service.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Services</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm underline">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
          >
            Add service
          </button>
        </div>
      </header>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show inactive services
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {editing && (
        <ServiceForm
          service={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No services yet. Add the first one.
        </p>
      ) : (
        SERVICE_CATEGORIES.map((cat) => {
          const items = services.filter((s) => s.category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                {SERVICE_CATEGORY_LABELS[cat]}
              </h2>
              <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
                {items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className={s.isActive ? '' : 'opacity-50'}>
                      <p className="font-medium">
                        {s.name} {!s.isActive && <span className="text-xs">(inactive)</span>}
                      </p>
                      <p className="text-sm text-stone-600">
                        {s.durationMinutes} min · {usd.format(s.priceUsd)}
                        {s.followUpIntervalDays ? ` · follow-up after ${s.followUpIntervalDays} days` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button type="button" onClick={() => setEditing(s)} className="rounded-md border border-stone-300 px-3 py-1">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive(s, !s.isActive)}
                        className="rounded-md border border-stone-300 px-3 py-1"
                      >
                        {s.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}

function ServiceForm({
  service,
  onCancel,
  onSaved,
}: {
  service: Service | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
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
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (name: string) =>
    fieldErrors[name] && <p className="text-sm text-red-700">{fieldErrors[name]}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
      <h2 className="text-lg font-semibold">{service ? 'Edit service' : 'New service'}</h2>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">Name</label>
        <input id="name" name="name" required defaultValue={service?.name} className={field} />
        {err('name')}
      </div>

      <div className="space-y-1">
        <label htmlFor="category" className="text-sm font-medium">Category</label>
        <select id="category" name="category" defaultValue={service?.category ?? SERVICE_CATEGORIES[0]} className={field}>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        {err('category')}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="durationMinutes" className="text-sm font-medium">Duration (minutes)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={service?.durationMinutes ?? 60} className={field} />
          {err('durationMinutes')}
        </div>
        <div className="space-y-1">
          <label htmlFor="priceUsd" className="text-sm font-medium">Price (USD)</label>
          <input id="priceUsd" name="priceUsd" type="number" min={0} step="0.01" required defaultValue={service?.priceUsd} className={field} />
          {err('priceUsd')}
        </div>
        <div className="space-y-1">
          <label htmlFor="followUpIntervalDays" className="text-sm font-medium">Follow-up after (days)</label>
          <input id="followUpIntervalDays" name="followUpIntervalDays" type="number" min={1} placeholder="None" defaultValue={service?.followUpIntervalDays ?? ''} className={field} />
          {err('followUpIntervalDays')}
        </div>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
