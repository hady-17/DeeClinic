'use client';

import { OPEN_STATUSES, formatUsd, type Appointment } from '@deeclinic/shared';
import Link from 'next/link';
import { useState } from 'react';
import { AppointmentPayments } from '@/components/AppointmentPayments';
import { Icon } from '@/components/Icon';
import { VisitNotes } from '@/components/VisitNotes';
import { Alert, Avatar, Badge, Button } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { APPOINTMENT_STATUS } from '@/lib/status';
import { formatDateTime, timeOf } from '@/lib/time';

type Action = 'complete' | 'no-show' | 'cancel';

const QUESTION: Record<Action, { text: string; yes: string; variant: 'primary' | 'danger'; done: string }> = {
  complete: { text: 'Mark this visit as completed?', yes: 'Yes, complete it', variant: 'primary', done: 'Visit completed' },
  'no-show': { text: 'Mark this client as a no-show? The slot is freed.', yes: 'Yes, no-show', variant: 'danger', done: 'Marked as no-show' },
  cancel: { text: 'Cancel this appointment and free the slot?', yes: 'Yes, cancel it', variant: 'danger', done: 'Appointment cancelled' },
};

export function AppointmentDetails({
  appointment: a,
  tz,
  onChanged,
  onEdit,
}: {
  appointment: Appointment;
  tz: string;
  onChanged: (message: string) => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const open = OPEN_STATUSES.includes(a.status);
  const status = APPOINTMENT_STATUS[a.status];

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ sessionConsumed?: boolean }>(`/appointments/${a.id}/${action}`, { method: 'POST' });
      onChanged(QUESTION[action].done + (r?.sessionConsumed ? '. A package session was used.' : ''));
    } catch (e) {
      setError(describeError(e, 'Something went wrong.'));
      setConfirming(null);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Who and when */}
      <div className="flex items-start gap-3">
        <Avatar name={a.clientName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/clients/${a.clientId}`} className="text-lg font-semibold tracking-tight text-fg hover:underline">
              {a.clientName}
            </Link>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="phone" size={14} /> {a.clientPhone}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl bg-sunken p-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Service</dt>
          <dd className="mt-0.5 font-medium text-fg">{a.serviceName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Price</dt>
          <dd className="mt-0.5 font-medium text-fg">{a.clientPackageId ? 'Package visit' : formatUsd(a.priceUsd)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">When</dt>
          <dd className="mt-0.5 font-medium text-fg">
            {formatDateTime(a.startAt, tz)} to {timeOf(a.endAt, tz)}
          </dd>
        </div>
        {a.notes && (
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Booking note</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-fg">{a.notes}</dd>
          </div>
        )}
      </dl>

      {error && <Alert tone="bad">{error}</Alert>}

      {/* The next step for an open visit comes first */}
      {open &&
        (confirming ? (
          <div className="space-y-3 rounded-xl border border-line-strong bg-surface p-4" role="group" aria-label="Confirm">
            <p className="text-sm font-medium text-fg">{QUESTION[confirming].text}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={QUESTION[confirming].variant} loading={busy} onClick={() => run(confirming)}>
                {busy ? 'Working…' : QUESTION[confirming].yes}
              </Button>
              <Button disabled={busy} onClick={() => setConfirming(null)}>
                Go back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="check" onClick={() => setConfirming('complete')}>
              Complete visit
            </Button>
            <Button icon="edit" onClick={onEdit}>
              Reschedule
            </Button>
            <Button onClick={() => setConfirming('no-show')}>No-show</Button>
            <Button variant="ghost" onClick={() => setConfirming('cancel')}>
              Cancel
            </Button>
          </div>
        ))}

      <AppointmentPayments appointment={a} />
      <VisitNotes appointmentId={a.id} canAdd={a.status !== 'cancelled'} />
    </div>
  );
}
