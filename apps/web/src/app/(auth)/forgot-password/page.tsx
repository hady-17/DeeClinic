'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthLayout } from '@/components/AuthLayout';
import { Alert, Button, Field, Input, LinkButton } from '@/components/ui';
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
    <AuthLayout
      title="Reset your password"
      description={sent ? undefined : 'Enter your email and we will send you a link to choose a new one.'}
      footer={
        <Link href="/login" className="font-medium text-primary-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert tone="ok">
            If that email belongs to an account, a link is on its way. It can take a few minutes. The link
            works once and expires after an hour.
          </Alert>
          <LinkButton href="/login" variant="secondary" className="w-full">
            Back to sign in
          </LinkButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          {error && <Alert tone="bad">{error}</Alert>}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
