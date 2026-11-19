'use client';

import { ROLES, ROLE_LABELS, type Me, type Role, type UserSummary } from '@deeclinic/shared';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Alert, Avatar, Badge, Button, Card, Field, Input, ListSkeleton, PageHeader, Select, type Tone } from '@/components/ui';
import { api, ApiError, describeError } from '@/lib/api';

const ROLE_TONE: Record<Role, Tone> = { owner: 'accent', manager: 'primary', staff: 'neutral' };

type Pending =
  | { id: string; kind: 'deactivate' | 'reactivate' | 'delete' }
  | { id: string; kind: 'role'; role: Role };

export default function UsersPage() {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ data: Me }>('/me'), api<{ data: UserSummary[] }>('/users')])
      .then(([m, u]) => {
        if (cancelled) return;
        setMe(m.data);
        setUsers(u.data);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(describeError(e, 'Could not load the team.'));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'role') {
        await api(`/users/${pending.id}`, { method: 'PATCH', body: JSON.stringify({ role: pending.role }) });
      } else if (pending.kind === 'delete') {
        await api(`/users/${pending.id}`, { method: 'DELETE' });
      } else {
        await api(`/users/${pending.id}/${pending.kind}`, { method: 'POST' });
      }
      toast.show(
        { role: 'Role changed', delete: 'User deleted', deactivate: 'User deactivated', reactivate: 'User reactivated' }[pending.kind],
      );
      setPending(null);
      reload();
    } catch (e) {
      setError(describeError(e, 'Something went wrong.'));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Team" />
        <Alert tone="warn">Only the clinic owner can manage the team.</Alert>
      </>
    );
  }

  const nameOf = (id: string) => users?.find((u) => u.id === id)?.fullName ?? 'this user';
  const question = (p: Pending) => {
    const n = nameOf(p.id);
    switch (p.kind) {
      case 'deactivate':
        return `Deactivate ${n}? They are signed out straight away and cannot sign in until you reactivate them.`;
      case 'reactivate':
        return `Let ${n} sign in again?`;
      case 'delete':
        return `Permanently delete ${n}? This only works for accounts that have not recorded anything. Otherwise deactivate instead.`;
      case 'role':
        return `Change ${n} to ${ROLE_LABELS[p.role]}?`;
    }
  };

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can sign in, and what each person can do. Staff run the day. Managers also set up the catalog and correct payments."
        actions={
          <Button variant="primary" icon="userPlus" onClick={() => setAdding(true)}>
            Add a team member
          </Button>
        }
      />

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      {pending && (
        <Alert tone="warn" className="mb-4">
          <p className="font-medium">{question(pending)}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" loading={busy} onClick={confirm}>
              {busy ? 'Working…' : 'Yes, continue'}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      )}

      {users === null ? (
        <ListSkeleton rows={3} />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {users.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-4 p-4">
                <Avatar name={u.fullName} size={42} />
                <div className={`min-w-0 flex-1 ${u.isActive ? '' : 'opacity-60'}`}>
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {u.fullName}
                    {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    {!u.isActive && <Badge tone="bad">Deactivated</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">{u.email ?? 'No email'}</p>
                  <p className="text-xs text-faint">
                    {u.lastSignInAt ? `Last signed in ${new Date(u.lastSignInAt).toLocaleString()}` : 'Has not signed in yet'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    Role for {u.fullName}
                  </label>
                  <div className="w-32">
                    <Select
                      id={`role-${u.id}`}
                      value={u.role}
                      disabled={isMe || busy}
                      onChange={(e) => setPending({ id: u.id, kind: 'role', role: e.target.value as Role })}
                      className="h-9"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {!isMe && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => setPending({ id: u.id, kind: u.isActive ? 'deactivate' : 'reactivate' })}>
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ id: u.id, kind: 'delete' })}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {adding && (
        <Modal title="Add a team member" onClose={() => setAdding(false)}>
          <AddUserForm
            onCancel={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              toast.show('Team member added');
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function AddUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'invite' | 'password'>('invite');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: f.get('email'),
          fullName: f.get('fullName'),
          role: f.get('role'),
          ...(mode === 'password' && { password: f.get('password') }),
        }),
      });
      onCreated();
    } catch (err) {
      setError(describeError(err, 'Could not create the user.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" required data-autofocus />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field
        label="Role"
        htmlFor="role"
        hint="Staff run the calendar, clients and notes. Managers can also change services, settings and import clients. Only owners manage the team."
      >
        <Select id="role" name="role" defaultValue="staff">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-fg">How do they get in?</legend>
        {(
          [
            { value: 'invite', title: 'Send an invite email', hint: 'They choose their own password.' },
            { value: 'password', title: 'Set a password now', hint: 'You tell them the password yourself.' },
          ] as const
        ).map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${mode === o.value ? 'border-primary bg-primary-soft/40' : 'border-line'}`}
          >
            <input type="radio" name="mode" checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-0.5 accent-(--c-primary)" />
            <span>
              <span className="block font-medium text-fg">{o.title}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === 'password' && (
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
        </Field>
      )}

      {error && <Alert tone="bad">{error}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Creating…' : mode === 'invite' ? 'Send invite' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}
