'use client';

import { ROLES, ROLE_LABELS, type Me, type Role, type UserSummary } from '@deeclinic/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { api, ApiError, describeError } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';
const smallBtn = 'rounded-md border border-stone-300 px-2.5 py-1 text-sm disabled:opacity-60';

type Pending =
  | { id: string; kind: 'deactivate' | 'reactivate' | 'delete' }
  | { id: string; kind: 'role'; role: Role };

export default function UsersPage() {
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
        else setError(describeError(e, 'Could not load users.'));
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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert">Only the clinic owner can manage users.</p>
        <Link href="/dashboard" className="underline">Back to dashboard</Link>
      </main>
    );
  }

  const nameOf = (id: string) => users?.find((u) => u.id === id)?.fullName ?? 'this user';
  const question = (p: Pending) => {
    const n = nameOf(p.id);
    switch (p.kind) {
      case 'deactivate': return `Deactivate ${n}? They are signed out straight away and cannot sign in until you reactivate them.`;
      case 'reactivate': return `Let ${n} sign in again?`;
      case 'delete': return `Permanently delete ${n}? This only works for accounts that have not recorded anything. Otherwise deactivate instead.`;
      case 'role': return `Change ${n} to ${ROLE_LABELS[p.role]}?`;
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
          <button type="button" onClick={() => setAdding(true)} className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
            Add user
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {pending && (
        <div role="alertdialog" aria-label="Confirm" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm">{question(pending)}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={confirm} className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60">
              {busy ? 'Working…' : 'Yes, continue'}
            </button>
            <button type="button" disabled={busy} onClick={() => setPending(null)} className={smallBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {users === null ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {users.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className={u.isActive ? '' : 'opacity-60'}>
                  <p className="font-medium">
                    {u.fullName} {isMe && <span className="text-xs text-stone-500">(you)</span>}
                    {!u.isActive && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs">Deactivated</span>}
                  </p>
                  <p className="text-sm text-stone-600">{u.email ?? 'No email'}</p>
                  <p className="text-xs text-stone-500">
                    {u.lastSignInAt ? `Last signed in ${new Date(u.lastSignInAt).toLocaleString()}` : 'Has not signed in yet'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.fullName}</label>
                  <select
                    id={`role-${u.id}`}
                    value={u.role}
                    disabled={isMe || busy}
                    onChange={(e) => setPending({ id: u.id, kind: 'role', role: e.target.value as Role })}
                    className="rounded-md border border-stone-300 px-2 py-1 text-sm disabled:opacity-60"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  {!isMe && (
                    <>
                      {u.isActive ? (
                        <button type="button" disabled={busy} onClick={() => setPending({ id: u.id, kind: 'deactivate' })} className={smallBtn}>
                          Deactivate
                        </button>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => setPending({ id: u.id, kind: 'reactivate' })} className={smallBtn}>
                          Reactivate
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => setPending({ id: u.id, kind: 'delete' })} className={`${smallBtn} text-red-800`}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <Modal title="Add user" onClose={() => setAdding(false)}>
          <AddUserForm
            onCancel={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              reload();
            }}
          />
        </Modal>
      )}
    </main>
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
        <input id="fullName" name="fullName" required className={field} />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required className={field} />
      </div>
      <div className="space-y-1">
        <label htmlFor="role" className="text-sm font-medium">Role</label>
        <select id="role" name="role" defaultValue="staff" className={field}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          Staff run the calendar, clients and notes. Managers can also change services, settings and import
          clients. Only owners manage users.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How do they get in?</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" checked={mode === 'invite'} onChange={() => setMode('invite')} className="mt-1" />
          <span>Send an invite email. They choose their own password.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" checked={mode === 'password'} onChange={() => setMode('password')} className="mt-1" />
          <span>Set a password now, and tell them yourself.</span>
        </label>
      </fieldset>

      {mode === 'password' && (
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={field} />
          <p className="text-xs text-stone-500">At least 10 characters.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {saving ? 'Creating…' : mode === 'invite' ? 'Send invite' : 'Create user'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
