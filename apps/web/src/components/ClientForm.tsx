'use client';

import {
  CLIENT_SOURCES,
  CLIENT_SOURCE_LABELS,
  type Client,
  type ClientInput,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

export function ClientForm({
  client,
  onSaved,
  submitLabel,
}: {
  client: Client | null;
  onSaved: (saved: Client) => void;
  submitLabel?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    setDuplicateId(null);
    const f = new FormData(e.currentTarget);
    const body: ClientInput = {
      fullName: String(f.get('fullName')),
      phoneE164: String(f.get('phoneE164')),
      instagramHandle: String(f.get('instagramHandle')) as ClientInput['instagramHandle'],
      email: String(f.get('email')) as ClientInput['email'],
      source: String(f.get('source')) as ClientInput['source'],
      whatsappConsent: f.get('whatsappConsent') === 'on',
      notes: String(f.get('notes')) as ClientInput['notes'],
    };
    try {
      const r = await api<{ data: Client }>(client ? `/clients/${client.id}` : '/clients', {
        method: client ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved(r.data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues ?? [];
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
        setFormError('Please fix the highlighted fields.');
      } else if (err instanceof ApiError && err.code === 'CONFLICT') {
        setFieldErrors({ phoneE164: err.message });
        setDuplicateId((err.details as { existingClientId?: string })?.existingClientId ?? null);
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName} className="sm:col-span-2">
          <Input id="fullName" name="fullName" required defaultValue={client?.fullName} aria-invalid={Boolean(fieldErrors.fullName)} data-autofocus={client ? undefined : true} />
        </Field>

        <Field
          label="WhatsApp / phone"
          htmlFor="phoneE164"
          hint="International format, for example +961 71 123 456"
          error={fieldErrors.phoneE164}
        >
          <Input id="phoneE164" name="phoneE164" required inputMode="tel" placeholder="+961 71 123 456" defaultValue={client?.phoneE164} aria-invalid={Boolean(fieldErrors.phoneE164)} />
          {duplicateId && (
            <Link href={`/clients/${duplicateId}`} className="mt-1.5 inline-block text-sm font-medium text-primary-ink hover:underline">
              Open the existing client
            </Link>
          )}
        </Field>

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" name="email" type="email" defaultValue={client?.email ?? ''} aria-invalid={Boolean(fieldErrors.email)} />
        </Field>

        <Field label="Instagram" htmlFor="instagramHandle" error={fieldErrors.instagramHandle}>
          <Input id="instagramHandle" name="instagramHandle" placeholder="@handle" defaultValue={client?.instagramHandle ?? ''} aria-invalid={Boolean(fieldErrors.instagramHandle)} />
        </Field>

        <Field label="How they found the clinic" htmlFor="source" error={fieldErrors.source}>
          <Select id="source" name="source" defaultValue={client?.source ?? ''}>
            <option value="">Not recorded</option>
            {CLIENT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {CLIENT_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes" htmlFor="notes" error={fieldErrors.notes} className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ''} />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-sunken/60 p-4">
        <Checkbox
          name="whatsappConsent"
          defaultChecked={Boolean(client?.whatsappConsentAt)}
          label="The client agreed to receive WhatsApp reminders and messages from the clinic."
          hint={client?.whatsappConsentAt ? `Consent recorded ${new Date(client.whatsappConsentAt).toLocaleDateString()}.` : 'Reminders are only sent to clients who have agreed.'}
        />
        {client?.whatsappOptOutAt && (
          <Alert tone="warn">
            This client replied STOP on {new Date(client.whatsappOptOutAt).toLocaleDateString()}. No messages will be sent.
          </Alert>
        )}
      </div>

      {formError && <Alert tone="bad">{formError}</Alert>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : (submitLabel ?? 'Save')}
        </Button>
      </div>
    </form>
  );
}
