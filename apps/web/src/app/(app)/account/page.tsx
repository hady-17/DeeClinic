'use client';

import type { PasscodeStatus } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { formatDateTime } from '@/lib/time';

export default function AccountPage() {
  const me = useMe();
  const tz = useClinicTz();
  const toast = useToast();
  const canHavePasscode = hasPermission(me, 'payments.void');
  const [status, setStatus] = useState<PasscodeStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const r = await api<{ data: PasscodeStatus }>('/me/passcode', {
        method: 'PUT',
        body: JSON.stringify({ password: f.get('password'), passcode }),
      });
      setStatus(r.data);
      toast.show('Passcode saved');
      setFormKey((k) => k + 1); // clears the form, so nothing sensitive stays on screen
    } catch (err) {
      setError(describeError(err, 'Could not save the passcode.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My account" description={me ? `${me.fullName} · ${me.email ?? ''}` : undefined} />

      <Card className="space-y-3 p-6">
        <h2 className="text-base font-semibold text-fg">Appearance</h2>
        <p className="text-sm text-muted">Choose a light or dark look, or follow your device. This is saved on this device only.</p>
        <ThemeToggle />
      </Card>

      {me && !canHavePasscode ? (
        <Card className="p-6 text-sm text-muted">
          Passcodes are for owners and managers, who confirm sensitive actions such as voiding a payment with one. Your role does not need one.
        </Card>
      ) : (
        <Card className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
                <Icon name="key" size={18} /> My passcode
              </h2>
              <p className="mt-1 text-sm text-muted">
                A personal 6-digit number you enter to confirm sensitive actions, such as voiding a payment. Do not share it. Five wrong tries lock it for 15 minutes.
              </p>
            </div>
            {status && (status.set ? <Badge tone="ok">Set</Badge> : <Badge tone="warn">Not set</Badge>)}
          </div>

          {status?.set && status.updatedAt && <p className="text-sm text-muted">Last changed {formatDateTime(status.updatedAt, tz)}.</p>}

          <form key={formKey} onSubmit={onSubmit} className="space-y-4 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-fg">{status?.set ? 'Change your passcode' : 'Set your passcode'}</h3>

            <Field label="Your account password" htmlFor="password" hint="Asked again so only you can set it, even on a screen that is already signed in.">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New passcode" htmlFor="passcode" hint="Avoid repeats and sequences like 111111 or 123456.">
                <Input id="passcode" name="passcode" type="password" inputMode="numeric" autoComplete="off" required pattern="\d{6}" maxLength={6} placeholder="6 digits" className="tracking-widest" />
              </Field>
              <Field label="Repeat it" htmlFor="confirm">
                <Input id="confirm" name="confirm" type="password" inputMode="numeric" autoComplete="off" required pattern="\d{6}" maxLength={6} className="tracking-widest" />
              </Field>
            </div>

            {error && <Alert tone="bad">{error}</Alert>}

            <Button type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : 'Save passcode'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
