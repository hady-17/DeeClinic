'use client';

import type { Appointment } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppointmentModal } from '@/components/AppointmentModal';
import { APPOINTMENTS_CHANGED, useBooking } from '@/components/BookingProvider';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Alert, Badge, Card, EmptyState, ListSkeleton, PageHeader, SectionHeading, Skeleton, cn } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { hasPermission, useClinicTz, useMe } from '@/lib/hooks';
import { APPOINTMENT_STATUS } from '@/lib/status';
import { addDays, dayRangeUtc, formatDayLong, timeOf, todayStr } from '@/lib/time';

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

export default function DashboardPage() {
  const me = useMe();
  const tz = useClinicTz();
  const toast = useToast();
  const { openBooking } = useBooking();

  const [today, setToday] = useState<Appointment[] | null>(null);
  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // "Now", refreshed each minute, so the greeting and "Next up" stay current
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const day = todayStr(tz);

  useEffect(() => {
    let cancelled = false;
    const range = (from: string, days: number) => {
      const r = dayRangeUtc(from, days, tz);
      return `/appointments?from=${encodeURIComponent(r.from.toISOString())}&to=${encodeURIComponent(r.to.toISOString())}`;
    };
    Promise.all([
      api<{ data: Appointment[] }>(range(day, 1)),
      api<{ data: Appointment[] }>(range(addDays(day, 1), 7)),
    ])
      .then(([t, w]) => {
        if (cancelled) return;
        setToday(t.data.filter((a) => a.status !== 'cancelled'));
        setWeekCount(w.data.filter((a) => a.status === 'scheduled' || a.status === 'confirmed').length);
        setError(null);
      })
      .catch((e) => !cancelled && setError(describeError(e, 'Could not load today’s schedule.')));
    return () => {
      cancelled = true;
    };
  }, [tz, day, reloadKey]);

  // Reload when a booking is made from anywhere in the app
  useEffect(() => {
    const reload = () => setReloadKey((k) => k + 1);
    window.addEventListener(APPOINTMENTS_CHANGED, reload);
    return () => window.removeEventListener(APPOINTMENTS_CHANGED, reload);
  }, []);

  const hour = Number(timeOf(new Date(now).toISOString(), tz).slice(0, 2));
  const firstName = me?.fullName.split(' ')[0];
  const open = today?.filter((a) => a.status === 'scheduled' || a.status === 'confirmed') ?? [];
  const done = today?.filter((a) => a.status === 'completed').length ?? 0;
  const next = open.find((a) => new Date(a.endAt).getTime() > now);
  const canBook = hasPermission(me, 'appointments.write');

  const actions: { icon: IconName; title: string; hint: string; onClick?: () => void; href?: string; show: boolean }[] = [
    { icon: 'plus', title: 'Book an appointment', hint: 'Pick a client and a time', onClick: () => openBooking(), show: canBook },
    { icon: 'userPlus', title: 'Add a client', hint: 'Create a new client profile', href: '/clients/new', show: hasPermission(me, 'clients.write') },
    { icon: 'calendar', title: 'Open the calendar', hint: 'Day and week view', href: '/calendar', show: true },
    { icon: 'search', title: 'Find a client', hint: 'Search by name or phone', href: '/clients', show: hasPermission(me, 'clients.read') },
  ];

  return (
    <>
      <PageHeader
        title={me ? `${greeting(hour)}, ${firstName}` : <Skeleton className="h-8 w-64" />}
        description={formatDayLong(day)}
      />

      {error && <Alert tone="bad" className="mb-6">{error}</Alert>}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-4">
        <StatCard label="Today" value={today ? String(today.length) : null} detail={today ? `${done} done · ${open.length} to go` : ''} icon="calendar" />
        <StatCard
          label="Next up"
          value={today ? (next ? timeOf(next.startAt, tz) : '—') : null}
          detail={today ? (next ? `${next.clientName} · ${next.serviceName}` : 'Nothing else today') : ''}
          icon="clock"
        />
        <StatCard label="Next 7 days" value={weekCount === null ? null : String(weekCount)} detail="booked after today" icon="users" />
      </div>

      <section aria-label="Quick actions" className="mb-8">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {actions
            .filter((a) => a.show)
            .map((a) => {
              const inner = (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{a.title}</span>
                    <span className="hidden truncate text-xs text-muted sm:block">{a.hint}</span>
                  </span>
                </>
              );
              const cls = 'flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:border-primary/50 hover:bg-sunken sm:flex-row sm:items-center sm:gap-3 sm:p-4';
              return a.href ? (
                <Link key={a.title} href={a.href} className={cls}>{inner}</Link>
              ) : (
                <button key={a.title} type="button" onClick={a.onClick} className={cls}>{inner}</button>
              );
            })}
        </div>
      </section>

      <section aria-label="Today's schedule" className="space-y-3">
        <SectionHeading
          title="Today's schedule"
          action={
            <Link href="/calendar" className="text-sm font-medium text-primary-ink hover:underline">
              Full calendar
            </Link>
          }
        />
        {today === null ? (
          <ListSkeleton rows={3} />
        ) : today.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No appointments today"
            description="A quiet day. You can book someone in now."
            action={canBook ? <button type="button" onClick={() => openBooking()} className="text-sm font-medium text-primary-ink hover:underline">Book an appointment</button> : undefined}
          />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {today.map((a) => {
              const st = APPOINTMENT_STATUS[a.status];
              const isNext = next?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={cn('flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-sunken', isNext && 'bg-primary-soft/40')}
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-semibold text-fg">{timeOf(a.startAt, tz)}</p>
                    <p className="text-xs text-muted">{timeOf(a.endAt, tz)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{a.clientName}</p>
                    <p className="truncate text-sm text-muted">
                      {a.serviceName}
                      {a.clientPackageId && ' · package'}
                    </p>
                  </div>
                  {isNext && <Badge tone="primary">Next</Badge>}
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Icon name="chevronRight" size={16} className="hidden text-faint sm:block" />
                </button>
              );
            })}
          </Card>
        )}
      </section>

      {selected && (
        <AppointmentModal
          appointment={selected}
          tz={tz}
          onClose={() => setSelected(null)}
          onChanged={(message) => {
            setSelected(null);
            setReloadKey((k) => k + 1);
            toast.show(message);
          }}
        />
      )}
    </>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string | null; detail: string; icon: IconName }) {
  return (
    <Card className="min-w-0 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between text-muted sm:mb-3">
        <span className="text-xs font-medium sm:text-sm">{label}</span>
        <Icon name={icon} size={18} className="hidden sm:block" />
      </div>
      {value === null ? <Skeleton className="h-8 w-16 sm:h-9 sm:w-20" /> : <p className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{value}</p>}
      <p className="mt-1 truncate text-xs text-muted sm:text-sm">{detail || " "}</p>
    </Card>
  );
}
