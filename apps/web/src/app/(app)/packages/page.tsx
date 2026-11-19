'use client';

import {
  formatUsd,
  type PackageTemplate,
  type PackageTemplateInput,
  type Service,
} from '@deeclinic/shared';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, ListSkeleton, PageHeader, Select } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

export default function PackagesPage() {
  const me = useMe();
  const toast = useToast();
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
      toast.show(isActive ? `${t.name} is on offer again` : `${t.name} is no longer on offer`);
      reload();
    } catch (e) {
      setError(describeError(e, 'Could not update the package.'));
    }
  }

  return (
    <>
      <PageHeader
        title="Packages"
        description="Multi-session offers you can sell. A package that is already sold keeps the sessions, price and validity it was sold with, even if you change the offer later."
        actions={
          canManage && (
            <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
              Add package
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Checkbox label="Show inactive packages" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
      </div>

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      {templates === null ? (
        <ListSkeleton rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon="box"
          title="No packages yet"
          description="Create an offer such as six laser sessions at a set price."
          action={canManage ? <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Add the first package</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col justify-between gap-4 p-5">
              <div className={t.isActive ? '' : 'opacity-60'}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-fg">{t.name}</p>
                  {!t.isActive && <Badge>Inactive</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{t.serviceName}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-fg">{formatUsd(t.priceUsd)}</p>
                <p className="text-sm text-muted">
                  {t.sessionCount} sessions · {formatUsd(t.priceUsd / t.sessionCount)} each · valid {t.validityDays} days
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActive(t, !t.isActive)}>
                    {t.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New package' : 'Edit package'} onClose={() => setEditing(null)}>
          <TemplateForm
            template={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              toast.show(editing === 'new' ? 'Package added' : 'Package saved');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
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
    <form onSubmit={submit} className="space-y-5">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={template?.name} placeholder="6 laser sessions" data-autofocus />
      </Field>
      <Field label="Service" htmlFor="serviceId" hint={services?.length === 0 ? 'Add a service first.' : undefined}>
        <Select id="serviceId" name="serviceId" required defaultValue={template?.serviceId ?? ''}>
          <option value="">{services === null ? 'Loading…' : 'Choose a service'}</option>
          {services?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sessions" htmlFor="sessionCount">
          <Input id="sessionCount" name="sessionCount" type="number" min={2} max={100} required defaultValue={template?.sessionCount ?? 6} />
        </Field>
        <Field label="Price (USD)" htmlFor="priceUsd">
          <Input id="priceUsd" name="priceUsd" type="number" min={0} step="0.01" required defaultValue={template?.priceUsd} />
        </Field>
        <Field label="Valid for (days)" htmlFor="validityDays">
          <Input id="validityDays" name="validityDays" type="number" min={1} required defaultValue={template?.validityDays ?? 180} />
        </Field>
      </div>
      {template && <Alert tone="info">Changes apply to new sales only. Packages already sold are not affected.</Alert>}
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : 'Save package'}
        </Button>
      </div>
    </form>
  );
}
