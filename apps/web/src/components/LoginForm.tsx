'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui';
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
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout title="Welcome back" description="Sign in to manage appointments, clients and payments.">
      <form onSubmit={onSubmit} className="space-y-4">
        {notice && <Alert tone={notice.tone === 'warn' ? 'warn' : 'info'}>{notice.text}</Alert>}

        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted hover:text-fg"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        {error && <Alert tone="bad">{error}</Alert>}

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary-ink hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
