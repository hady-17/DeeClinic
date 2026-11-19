'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { Alert, Button, Field, Input, LinkButton, Spinner } from '@/components/ui';
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

  return (
    <AuthLayout title="Choose a new password" description={status === 'ready' ? 'Pick something only you would know.' : undefined}>
      {status === 'checking' && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Checking your link…
        </p>
      )}

      {status === 'invalid' && (
        <div className="space-y-4">
          <Alert tone="warn">This link has expired or was already used.</Alert>
          <LinkButton href="/forgot-password" variant="primary" className="w-full">
            Request a new link
          </LinkButton>
        </div>
      )}

      {status === 'ready' && (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password" htmlFor="password" hint="At least 10 characters. A few words in a row make a strong password.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} autoFocus />
          </Field>
          <Field label="Repeat the password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          {error && <Alert tone="bad">{error}</Alert>}
          <Button type="submit" variant="primary" loading={saving} className="w-full">
            {saving ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
