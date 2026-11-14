'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { describeError, publicApi } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

interface LoginResponse {
  data: { session: { accessToken: string; refreshToken: string } };
}

const NOTICES: Record<string, { text: string; tone: 'info' | 'warn' }> = {
  expired: { text: 'Your session ended. Please sign in again.', tone: 'info' },
  disabled: { text: 'This account has been deactivated. Contact the clinic owner.', tone: 'warn' },
  'password-set': { text: 'Password updated. Sign in with your new password.', tone: 'info' },
};

export function LoginForm({ reason }: { reason?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const notice = reason ? NOTICES[reason] : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      // The API checks the password, throttles repeated failures and refuses deactivated accounts.
      const r = await publicApi<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const { error: sessionError } = await createClient().auth.setSession({
        access_token: r.data.session.accessToken,
        refresh_token: r.data.session.refreshToken,
      });
      if (sessionError) throw sessionError;
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(describeError(err, 'Could not sign in. Try again.'));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>

        {notice && (
          <p role="status" className={`rounded-md p-3 text-sm ${notice.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
            {notice.text}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-md border border-stone-300 px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-md border border-stone-300 px-3 py-2" />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="w-full rounded-md bg-stone-900 px-3 py-2 text-white disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm">
          <Link href="/forgot-password" className="underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </main>
  );
}
