'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, describeError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking' | 'ready' | 'invalid';

/**
 * Landing page for both the "reset password" and the "you have been invited" emails.
 * The link carries a one-time session in the address; it is used to set the password
 * and then discarded, and the person signs in again with the new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      // Expired or already-used links arrive with an error instead of tokens
      Promise.resolve().then(() => setStatus('invalid'));
      return;
    }
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        // Keep the tokens out of the address bar and the browser history
        window.history.replaceState(null, '', window.location.pathname);
        setStatus(sessionError ? 'invalid' : 'ready');
      });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) {
      setError('The two passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api('/auth/set-password', { method: 'POST', body: JSON.stringify({ password }) });
      await createClient().auth.signOut();
      router.replace('/login?reason=password-set');
    } catch (err) {
      setError(describeError(err, 'Could not set the password. Try again.'));
      setSaving(false);
    }
  }

  const field = 'w-full rounded-md border border-stone-300 px-3 py-2';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Choose a new password</h1>

        {status === 'checking' && <p className="text-stone-500">Checking your link…</p>}

        {status === 'invalid' && (
          <div role="alert" className="space-y-3 text-sm">
            <p>This link has expired or was already used.</p>
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">New password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={field} aria-describedby="hint" />
              <p id="hint" className="text-xs text-stone-500">
                At least 10 characters. A few words in a row make a strong password.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm" className="text-sm font-medium">Repeat the password</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={field} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={saving} className="w-full rounded-md bg-stone-900 px-3 py-2 text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
