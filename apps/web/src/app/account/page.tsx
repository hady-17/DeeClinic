'use client';

import type { PasscodeStatus } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, describeError } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { formatDateTime } from '@/lib/time';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2';

export default function AccountPage() {
  const me = useMe();
  const tz = useClinicTz();
  const canHavePasscode = hasPermission(me, 'payments.void');
  const [status, setStatus] = useState<PasscodeStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!canHavePasscode) return;
    let cancelled = false;
    api<{ data: PasscodeStatus }>('/me/passcode')
      .then((r) => !cancelled && setStatus(r.data))
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load your passcode status.')));
    return () => {
      cancelled = true;
    };
  }, [canHavePasscode]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const passcode = String(f.get('passcode'));
    if (passcode !== String(f.get('confirm'))) {
      setError('The two passcodes do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const r = await api<{ data: PasscodeStatus }>('/me/passcode', {
        method: 'PUT',
        body: JSON.stringify({ password: f.get('password'), passcode }),
      });
      setStatus(r.data);
      setDone(true);
      setFormKey((k) => k + 1); // clears the form, so nothing sensitive stays on screen
    } catch (err) {
      setError(describeError(err, 'Could not save the passcode.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My passcode</h1>
        <Link href="/dashboard" className="text-sm underline">Dashboard</Link>
      </header>

      {me && !canHavePasscode ? (
        <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
          Passcodes are for owners and managers, who confirm sensitive actions such as voiding a payment
          with one. Your role does not need one.
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-600">
            Your passcode is a 6-digit number you enter to confirm sensitive actions, such as voiding a
            payment. It is personal: do not share it. Five wrong tries lock it for 15 minutes.
          </p>

          <p className="text-sm" aria-live="polite">
            {status === null ? (
              'Checking…'
            ) : status.set ? (
              <>Passcode is set{status.updatedAt && <> (changed {formatDateTime(status.updatedAt, tz)})</>}.</>
            ) : (
              <span className="font-medium text-amber-800">You have not set a passcode yet.</span>
            )}
          </p>

          <form key={formKey} onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="font-semibold">{status?.set ? 'Change your passcode' : 'Set your passcode'}</h2>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">Your account password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className={field} aria-describedby="pw-hint" />
              <p id="pw-hint" className="text-xs text-stone-500">Asked again so only you can set it, even on a screen that is already signed in.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="passcode" className="text-sm font-medium">New passcode</label>
                <input id="passcode" name="passcode" type="password" inputMode="numeric" autoComplete="off" required pattern="\d{6}" maxLength={6} placeholder="6 digits" className={`${field} tracking-widest`} />
              </div>
              <div className="space-y-1">
                <label htmlFor="confirm" className="text-sm font-medium">Repeat it</label>
                <input id="confirm" name="confirm" type="password" inputMode="numeric" autoComplete="off" required pattern="\d{6}" maxLength={6} className={`${field} tracking-widest`} />
              </div>
            </div>
            <p className="text-xs text-stone-500">Avoid repeats and sequences like 111111 or 123456.</p>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            {done && <p role="status" className="text-sm text-green-700">Passcode saved.</p>}

            <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save passcode'}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
