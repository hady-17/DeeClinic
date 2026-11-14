'use client';

import {
  CLIENT_SOURCES,
  CLIENT_SOURCE_LABELS,
  type Client,
  type ClientInput,
} from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2';

export function ClientForm({
  client,
  onSaved,
}: {
  client: Client | null;
  onSaved: (saved: Client) => void;
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

  const err = (name: string) =>
    fieldErrors[name] && <p className="text-sm text-red-700">{fieldErrors[name]}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
        <input id="fullName" name="fullName" required defaultValue={client?.fullName} className={field} />
        {err('fullName')}
      </div>

      <div className="space-y-1">
        <label htmlFor="phoneE164" className="text-sm font-medium">WhatsApp / phone (international format)</label>
        <input id="phoneE164" name="phoneE164" required inputMode="tel" placeholder="+961 71 123 456" defaultValue={client?.phoneE164} className={field} />
        {err('phoneE164')}
        {duplicateId && (
          <Link href={`/clients/${duplicateId}`} className="text-sm underline">
            Open the existing client
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="instagramHandle" className="text-sm font-medium">Instagram</label>
          <input id="instagramHandle" name="instagramHandle" placeholder="@handle" defaultValue={client?.instagramHandle ?? ''} className={field} />
          {err('instagramHandle')}
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" defaultValue={client?.email ?? ''} className={field} />
          {err('email')}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="source" className="text-sm font-medium">How they found the clinic</label>
        <select id="source" name="source" defaultValue={client?.source ?? ''} className={field}>
          <option value="">Not recorded</option>
          {CLIENT_SOURCES.map((s) => (
            <option key={s} value={s}>{CLIENT_SOURCE_LABELS[s]}</option>
          ))}
        </select>
        {err('source')}
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">Notes</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ''} className={field} />
        {err('notes')}
      </div>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="whatsappConsent" defaultChecked={Boolean(client?.whatsappConsentAt)} className="mt-1" />
          <span>
            The client agreed to receive WhatsApp reminders and messages from the clinic.
            {client?.whatsappConsentAt && (
              <span className="block text-stone-500">
                Consent recorded {new Date(client.whatsappConsentAt).toLocaleDateString()}.
              </span>
            )}
          </span>
        </label>
        {client?.whatsappOptOutAt && (
          <p className="text-sm text-amber-800">
            This client replied STOP on {new Date(client.whatsappOptOutAt).toLocaleDateString()}. No
            messages will be sent.
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}

      <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
