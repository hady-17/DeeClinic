'use client';

import type { ClinicSettings } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<ClinicSettings>>({
    timezone: 'Asia/Beirut',
    reminderSendTime: '10:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ data: ClinicSettings | null }>('/clinic-settings')
      .then((r) => r.data && setSettings(r.data))
      .catch((e: ApiError) => setMessage({ type: 'error', text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ data: ClinicSettings }>('/clinic-settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: f.get('name'),
          phoneE164: f.get('phoneE164'),
          address: f.get('address'),
          timezone: f.get('timezone'),
          reminderSendTime: f.get('reminderSendTime'),
          noShowUsesSession: f.get('noShowUsesSession') === 'on',
        }),
      });
      setSettings(r.data);
      setMessage({ type: 'ok', text: 'Settings saved.' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        setMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      } else {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
      }
    } finally {
      setSaving(false);
    }
  }

  const err = (name: string) =>
    fieldErrors[name] && (
      <p id={`${name}-error`} className="text-sm text-red-700">
        {fieldErrors[name]}
      </p>
    );

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clinic settings</h1>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </header>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        // key remounts the form with fresh defaults once data has loaded or saved
        <form
          key={settings.updatedAt ?? 'new'}
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-6"
        >
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">Clinic name</label>
            <input id="name" name="name" required defaultValue={settings.name ?? ''} className={field} aria-describedby="name-error" />
            {err('name')}
          </div>

          <div className="space-y-1">
            <label htmlFor="phoneE164" className="text-sm font-medium">Phone (international format)</label>
            <input id="phoneE164" name="phoneE164" inputMode="tel" placeholder="+96171123456" defaultValue={settings.phoneE164 ?? ''} className={field} aria-describedby="phoneE164-error" />
            {err('phoneE164')}
          </div>

          <div className="space-y-1">
            <label htmlFor="address" className="text-sm font-medium">Address</label>
            <input id="address" name="address" defaultValue={settings.address ?? ''} className={field} />
            {err('address')}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="timezone" className="text-sm font-medium">Timezone</label>
              <input id="timezone" name="timezone" required defaultValue={settings.timezone} className={field} aria-describedby="timezone-error" />
              {err('timezone')}
            </div>
            <div className="space-y-1">
              <label htmlFor="reminderSendTime" className="text-sm font-medium">Reminder send time</label>
              <input id="reminderSendTime" name="reminderSendTime" type="time" required defaultValue={settings.reminderSendTime} className={field} aria-describedby="reminderSendTime-error" />
              {err('reminderSendTime')}
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="noShowUsesSession" defaultChecked={Boolean(settings.noShowUsesSession)} className="mt-1" />
              <span>
                A no-show on a package visit uses up one of the client&apos;s sessions.
                <span className="block text-stone-500">
                  Off by default. Cancelling never uses a session. Turning this on only affects no-shows
                  marked from now on.
                </span>
              </span>
            </label>
          </div>

          {message && (
            <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'text-sm text-red-700' : 'text-sm text-green-700'}>
              {message.text}
            </p>
          )}

          <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </main>
  );
}
