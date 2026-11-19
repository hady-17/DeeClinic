'use client';

import type { ClinicSettings } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Alert, Button, Card, Checkbox, Field, Input, PageHeader, Skeleton } from '@/components/ui';
import { api, ApiError, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';

export default function SettingsPage() {
  const me = useMe();
  const toast = useToast();
  const [settings, setSettings] = useState<Partial<ClinicSettings>>({
    timezone: 'Asia/Beirut',
    reminderSendTime: '10:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const canEdit = hasPermission(me, 'settings.write');

  useEffect(() => {
    api<{ data: ClinicSettings | null }>('/clinic-settings')
      .then((r) => r.data && setSettings(r.data))
      .catch((e) => setError(describeError(e, 'Could not load the settings.')))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
      toast.show('Settings saved');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        setError('Please fix the highlighted fields.');
      } else {
        setError(describeError(err, 'Could not save.'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your clinic's details and the rules the system follows." />

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}
      {!canEdit && !loading && <Alert tone="info" className="mb-4">You can view these settings. Only owners and managers can change them.</Alert>}

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        // key remounts the form with fresh defaults once data has loaded or saved
        <form key={settings.updatedAt ?? 'new'} onSubmit={onSubmit} className="space-y-6">
          <fieldset disabled={!canEdit} className="space-y-6">
            <Card className="space-y-5 p-6">
              <div>
                <h2 className="text-base font-semibold text-fg">Clinic</h2>
                <p className="text-sm text-muted">Shown to clients in messages.</p>
              </div>
              <Field label="Clinic name" htmlFor="name" error={fieldErrors.name}>
                <Input id="name" name="name" required defaultValue={settings.name ?? ''} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Phone" htmlFor="phoneE164" hint="International format, for example +96171123456" error={fieldErrors.phoneE164}>
                  <Input id="phoneE164" name="phoneE164" inputMode="tel" placeholder="+96171123456" defaultValue={settings.phoneE164 ?? ''} />
                </Field>
                <Field label="Address" htmlFor="address" error={fieldErrors.address}>
                  <Input id="address" name="address" defaultValue={settings.address ?? ''} />
                </Field>
              </div>
            </Card>

            <Card className="space-y-5 p-6">
              <div>
                <h2 className="text-base font-semibold text-fg">Time</h2>
                <p className="text-sm text-muted">All times in the app are shown in this timezone.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Timezone" htmlFor="timezone" error={fieldErrors.timezone} hint="For example Asia/Beirut">
                  <Input id="timezone" name="timezone" required defaultValue={settings.timezone} />
                </Field>
                <Field label="Reminder send time" htmlFor="reminderSendTime" error={fieldErrors.reminderSendTime} hint="When the daily reminders go out">
                  <Input id="reminderSendTime" name="reminderSendTime" type="time" required defaultValue={settings.reminderSendTime} />
                </Field>
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <div>
                <h2 className="text-base font-semibold text-fg">Packages</h2>
                <p className="text-sm text-muted">How packages treat visits that did not happen.</p>
              </div>
              <Checkbox
                name="noShowUsesSession"
                defaultChecked={Boolean(settings.noShowUsesSession)}
                label="A no-show on a package visit uses up one of the client's sessions."
                hint="Off by default. Cancelling never uses a session. Turning this on only affects no-shows marked from now on."
              />
            </Card>
          </fieldset>

          {canEdit && (
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
