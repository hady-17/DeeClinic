'use client';

import {
  formatUsd,
  type PackageTemplate,
  type PackageTemplateInput,
  type Service,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { api, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

export default function PackagesPage() {
  const me = useMe();
  const [templates, setTemplates] = useState<PackageTemplate[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<PackageTemplate | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const canManage = hasPermission(me, 'packages.manage');

  useEffect(() => {
    let cancelled = false;
    api<{ data: PackageTemplate[] }>(`/package-templates?includeInactive=${showInactive}`)
      .then((r) => {
        if (cancelled) return;
        setTemplates(r.data);
        setError(null);
      })
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load packages.')));
    return () => {
      cancelled = true;
    };
  }, [showInactive, reloadKey]);

  async function setActive(t: PackageTemplate, isActive: boolean) {
    try {
      await api(`/package-templates/${t.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      reload();
    } catch (e) {
      setError(describeError(e, 'Could not update the package.'));
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
          {canManage && (
            <button type="button" onClick={() => setEditing('new')} className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
              Add package
            </button>
          )}
        </div>
      </header>

      <p className="text-sm text-stone-600">
        These are the multi-session offers you can sell. A package that has already been sold keeps the
        sessions, price and validity it was sold with, even if you change the offer here later.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show inactive packages
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {templates === null ? (
        <p className="text-stone-500">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No packages yet.{canManage && ' Add the first one.'}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className={t.isActive ? '' : 'opacity-50'}>
                <p className="font-medium">
                  {t.name} {!t.isActive && <span className="text-xs">(inactive)</span>}
                </p>
                <p className="text-sm text-stone-600">
                  {t.sessionCount} × {t.serviceName} · {formatUsd(t.priceUsd)} · valid {t.validityDays} days
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2 text-sm">
                  <button type="button" onClick={() => setEditing(t)} className="rounded-md border border-stone-300 px-3 py-1">Edit</button>
                  <button type="button" onClick={() => setActive(t, !t.isActive)} className="rounded-md border border-stone-300 px-3 py-1">
                    {t.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New package' : 'Edit package'} onClose={() => setEditing(null)}>
          <TemplateForm
            template={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </main>
  );
}

function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template: PackageTemplate | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Service[] }>('/services')
      .then((r) => setServices(r.data))
      .catch((e) => {
        setServices([]);
        setError(describeError(e, 'Could not load services.'));
      });
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body: PackageTemplateInput = {
      name: String(f.get('name')),
      serviceId: String(f.get('serviceId')),
      sessionCount: Number(f.get('sessionCount')),
      priceUsd: Number(f.get('priceUsd')),
      validityDays: Number(f.get('validityDays')),
    };
    try {
      await api(template ? `/package-templates/${template.id}` : '/package-templates', {
        method: template ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError(describeError(err, 'Could not save the package.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">Name</label>
        <input id="name" name="name" required defaultValue={template?.name} placeholder="6 laser sessions" className={field} />
      </div>
      <div className="space-y-1">
        <label htmlFor="serviceId" className="text-sm font-medium">Service</label>
        <select id="serviceId" name="serviceId" required defaultValue={template?.serviceId ?? ''} className={field}>
          <option value="">{services === null ? 'Loading…' : 'Choose a service'}</option>
          {services?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {services?.length === 0 && <p className="text-sm text-amber-800">Add a service first.</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="sessionCount" className="text-sm font-medium">Sessions</label>
          <input id="sessionCount" name="sessionCount" type="number" min={2} max={100} required defaultValue={template?.sessionCount ?? 6} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="priceUsd" className="text-sm font-medium">Price (USD)</label>
          <input id="priceUsd" name="priceUsd" type="number" min={0} step="0.01" required defaultValue={template?.priceUsd} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="validityDays" className="text-sm font-medium">Valid for (days)</label>
          <input id="validityDays" name="validityDays" type="number" min={1} required defaultValue={template?.validityDays ?? 180} className={field} />
        </div>
      </div>
      {template && (
        <p className="text-xs text-stone-500">Changes apply to new sales only. Packages already sold are not affected.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
