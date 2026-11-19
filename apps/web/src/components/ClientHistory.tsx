'use client';

import { formatUsd, type ClientHistoryEntry, type ClinicSettings } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { VisitNotes } from '@/components/VisitNotes';
import { Alert, Badge, Card, EmptyState, ListSkeleton, SectionHeading } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { APPOINTMENT_STATUS } from '@/lib/status';
import { DEFAULT_TZ, dayNumber, dayOf, formatDateTime, monthYear, timeOf } from '@/lib/time';

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
    <section aria-label="Visit history" className="space-y-4">
      <SectionHeading
        title="Visits"
        action={visits && visits.length > 0 ? <span className="text-sm text-muted">{completed} completed</span> : undefined}
      />

      {error && <Alert tone="bad">{error}</Alert>}

      {visits === null ? (
        <ListSkeleton rows={3} />
      ) : visits.length === 0 ? (
        <EmptyState icon="calendar" title="No visits yet" description="Appointments booked for this client will appear here, with their notes." />
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => {
            const st = APPOINTMENT_STATUS[v.status];
            const day = dayOf(v.startAt, tz);
            return (
              <li key={v.id}>
                <Card className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 shrink-0 rounded-lg bg-sunken py-1.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{monthYear(day).slice(0, 3)}</p>
                      <p className="text-lg font-semibold leading-tight text-fg">{dayNumber(day)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-fg">{v.serviceName}</p>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {v.clientPackageId && (
                          <Badge tone="accent">
                            <Icon name="box" size={12} /> Package
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDateTime(v.startAt, tz)} to {timeOf(v.endAt, tz)}
                        {!v.clientPackageId && ` · ${formatUsd(v.priceUsd)}`}
                      </p>
                      {v.notes && <p className="mt-1 text-sm text-muted">Booking note: {v.notes}</p>}
                    </div>
                  </div>
                  <VisitNotes appointmentId={v.id} initialNotes={v.visitNotes} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
