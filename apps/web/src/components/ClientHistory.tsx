'use client';

import type { ClientHistoryEntry, ClinicSettings } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { VisitNotes } from '@/components/VisitNotes';
import { api, describeError } from '@/lib/api';
import { DEFAULT_TZ, formatDateTime, timeOf } from '@/lib/time';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const STATUS: Record<ClientHistoryEntry['status'], { label: string; style: string }> = {
  scheduled: { label: 'Upcoming', style: 'bg-sky-100 text-sky-900' },
  confirmed: { label: 'Confirmed', style: 'bg-indigo-100 text-indigo-900' },
  completed: { label: 'Completed', style: 'bg-emerald-100 text-emerald-900' },
  no_show: { label: 'No-show', style: 'bg-red-100 text-red-900' },
  cancelled: { label: 'Cancelled', style: 'bg-stone-100 text-stone-700' },
};

export function ClientHistory({ clientId }: { clientId: string }) {
  const [visits, setVisits] = useState<ClientHistoryEntry[] | null>(null);
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ data: { visits: ClientHistoryEntry[] } }>(`/clients/${clientId}/history`),
      api<{ data: ClinicSettings | null }>('/clinic-settings').catch(() => null),
    ])
      .then(([history, settings]) => {
        if (cancelled) return;
        setVisits(history.data.visits);
        if (settings?.data?.timezone) setTz(settings.data.timezone);
      })
      .catch((e) => {
        if (cancelled) return;
        setVisits([]);
        setError(describeError(e, 'Could not load the history.'));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const completed = visits?.filter((v) => v.status === 'completed').length ?? 0;

  return (
    <section aria-label="Visit history" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Visit history</h2>
        {visits && visits.length > 0 && (
          <span className="text-sm text-stone-500">
            {completed} completed visit{completed === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {visits === null ? (
        <p className="text-stone-500">Loading…</p>
      ) : visits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          No visits yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => (
            <li key={v.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{v.serviceName}</p>
                  <p className="text-sm text-stone-600">
                    {formatDateTime(v.startAt, tz)} to {timeOf(v.endAt, tz)} · {usd.format(v.priceUsd)}
                  </p>
                  {v.notes && <p className="mt-1 text-sm text-stone-600">Booking note: {v.notes}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[v.status].style}`}>
                  {STATUS[v.status].label}
                </span>
              </div>
              <VisitNotes appointmentId={v.id} initialNotes={v.visitNotes} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
