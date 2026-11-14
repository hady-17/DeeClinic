'use client';

import Link from 'next/link';
import { useState } from 'react';
import { describeError, publicApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await publicApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: new FormData(e.currentTarget).get('email') }),
      });
      setSent(true);
    } catch (err) {
      setError(describeError(err, 'Could not send the email. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reset your password</h1>

        {sent ? (
          <div role="status" className="space-y-3 text-sm">
            <p>
              If that email belongs to an account, a link to choose a new password is on its way. It
              can take a few minutes. The link works once and expires after an hour.
            </p>
            <Link href="/login" className="underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-stone-600">
              Enter your email and we will send you a link to choose a new password.
            </p>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-md border border-stone-300 px-3 py-2" />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="w-full rounded-md bg-stone-900 px-3 py-2 text-white disabled:opacity-60">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm">
              <Link href="/login" className="underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
