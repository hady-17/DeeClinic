'use client';

import { OPEN_STATUSES, type Appointment } from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { VisitNotes } from '@/components/VisitNotes';
import { api } from '@/lib/api';
import { formatDateTime, timeOf } from '@/lib/time';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const STATUS_LABEL: Record<Appointment['status'], string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

type Action = 'complete' | 'no-show' | 'cancel';

export function AppointmentDetails({
  appointment: a,
  tz,
  onChanged,
  onEdit,
}: {
  appointment: Appointment;
  tz: string;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const open = OPEN_STATUSES.includes(a.status);

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      await api(`/appointments/${a.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  const btn = 'rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-60';

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/clients/${a.clientId}`} className="text-lg font-medium underline">
          {a.clientName}
        </Link>
        <p className="text-sm text-stone-600">{a.clientPhone}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-stone-500">Service</dt>
        <dd>{a.serviceName}</dd>
        <dt className="text-stone-500">When</dt>
        <dd>
          {formatDateTime(a.startAt, tz)} to {timeOf(a.endAt, tz)}
        </dd>
        <dt className="text-stone-500">Price</dt>
        <dd>{usd.format(a.priceUsd)}</dd>
        <dt className="text-stone-500">Status</dt>
        <dd>{STATUS_LABEL[a.status]}</dd>
        {a.notes && (
          <>
            <dt className="text-stone-500">Notes</dt>
            <dd className="whitespace-pre-wrap">{a.notes}</dd>
          </>
        )}
      </dl>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <VisitNotes appointmentId={a.id} canAdd={a.status !== 'cancelled'} />

      {open &&
        (confirming ? (
          <div className="space-y-2 rounded-md bg-stone-50 p-3">
            <p className="text-sm">
              {confirming === 'cancel' && 'Cancel this appointment and free the slot?'}
              {confirming === 'no-show' && 'Mark this client as a no-show?'}
              {confirming === 'complete' && 'Mark this visit as completed?'}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => run(confirming)} className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-60">
                {busy ? 'Working…' : 'Yes'}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={btn}>
                Go back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirming('complete')} className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
              Complete
            </button>
            <button type="button" onClick={onEdit} className={btn}>
              Reschedule / edit
            </button>
            <button type="button" onClick={() => setConfirming('no-show')} className={btn}>
              No-show
            </button>
            <button type="button" onClick={() => setConfirming('cancel')} className={btn}>
              Cancel appointment
            </button>
          </div>
        ))}
    </div>
  );
}
