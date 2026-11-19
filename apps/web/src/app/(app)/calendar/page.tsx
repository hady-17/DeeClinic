'use client';

import type { Appointment, ClinicSettings } from '@deeclinic/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentModal } from '@/components/AppointmentModal';
import { APPOINTMENTS_CHANGED, useBooking } from '@/components/BookingProvider';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Alert, Button, IconButton, PageHeader, Segmented, Skeleton, cn } from '@/components/ui';
import { api, describeError } from '@/lib/api';
import { hasPermission, useMe } from '@/lib/hooks';
import { APPOINTMENT_STATUS } from '@/lib/status';
import {
  DEFAULT_TZ,
  addDays,
  dayNumber,
  dayOf,
  dayRangeUtc,
  minutesOfDay,
  monthYear,
  timeOf,
  todayStr,
  weekStart,
  weekdayShort,
} from '@/lib/time';

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 64;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

type View = 'day' | 'week';

export default function CalendarPage() {
  const me = useMe();
  const toast = useToast();
  const { openBooking } = useBooking();
  const [tz, setTz] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<View>('day');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  // The clinic timezone decides what "today" is
  useEffect(() => {
    api<{ data: ClinicSettings | null }>('/clinic-settings')
      .then((r) => r.data?.timezone ?? DEFAULT_TZ)
      .catch(() => DEFAULT_TZ)
      .then((zone) => {
        setTz(zone);
        setDay(todayStr(zone));
      });
  }, []);

  const days = useMemo(() => {
    if (!day) return [];
    if (view === 'day') return [day];
    const start = weekStart(day);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [day, view]);

  useEffect(() => {
    if (!tz || days.length === 0) return;
    let cancelled = false;
    const { from, to } = dayRangeUtc(days[0]!, days.length, tz);
    api<{ data: Appointment[] }>(
      `/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    )
      .then((r) => {
        if (cancelled) return;
        setAppointments(r.data);
        setError(null);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(describeError(e, 'Could not load the calendar.'));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tz, days, reloadKey]);

  // A booking made from the sidebar or a client page refreshes this view
  useEffect(() => {
    const reload = () => setReloadKey((k) => k + 1);
    window.addEventListener(APPOINTMENTS_CHANGED, reload);
    return () => window.removeEventListener(APPOINTMENTS_CHANGED, reload);
  }, []);

  // The "now" line moves once a minute
  useEffect(() => {
    if (!tz) return;
    const tick = () => setNowMinutes(minutesOfDay(new Date().toISOString(), tz));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [tz]);

  const closeSelected = useCallback(() => setSelected(null), []);

  if (!tz || !day) {
    return (
      <>
        <PageHeader title="Calendar" />
        <Skeleton className="h-[560px] w-full" />
      </>
    );
  }

  const step = view === 'day' ? 1 : 7;
  const today = todayStr(tz);
  const canBook = hasPermission(me, 'appointments.write');
  const rangeLabel =
    view === 'day'
      ? `${weekdayShort(day)} ${dayNumber(day)} ${monthYear(day)}`
      : `${dayNumber(days[0]!)} ${monthYear(days[0]!).split(' ')[0]!.slice(0, 3)} – ${dayNumber(days[6]!)} ${monthYear(days[6]!)}`;

  function onSlotClick(d: string, offsetY: number) {
    if (!canBook) return;
    const minutes = Math.round(((offsetY / HOUR_PX) * 60) / 15) * 15 + START_HOUR * 60;
    const clamped = Math.min(Math.max(minutes, START_HOUR * 60), END_HOUR * 60 - 15);
    const time = `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
    openBooking({ date: d, time });
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description={canBook ? 'Click an empty time to book it, or click an appointment to open it.' : 'Click an appointment to open it.'}
      />

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-line-strong bg-surface shadow-sm">
            <IconButton icon="chevronLeft" label={view === 'day' ? 'Previous day' : 'Previous week'} onClick={() => setDay(addDays(day, -step))} />
            <Button variant="ghost" size="sm" onClick={() => setDay(today)} disabled={days.includes(today)} className="rounded-none border-x border-line">
              Today
            </Button>
            <IconButton icon="chevronRight" label={view === 'day' ? 'Next day' : 'Next week'} onClick={() => setDay(addDays(day, step))} />
          </div>
          <h2 className="ml-1 text-base font-semibold text-fg" aria-live="polite">
            {rangeLabel}
          </h2>
        </div>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
          ]}
        />
      </div>

      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}

      <div className={cn('overflow-x-auto rounded-xl border border-line bg-surface shadow-card', view === 'day' && 'max-w-4xl')}>
        <div style={{ minWidth: view === 'week' ? 780 : undefined }}>
          {/* Day headings */}
          <div className="flex border-b border-line">
            <div className="w-14 shrink-0" />
            {days.map((d) => {
              const isToday = d === today;
              return (
                <div key={d} className="flex-1 border-l border-line px-2 py-2.5 text-center">
                  <p className={cn('text-xs font-medium uppercase tracking-wide', isToday ? 'text-primary-ink' : 'text-muted')}>{weekdayShort(d)}</p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold',
                      isToday ? 'bg-primary text-on-primary' : 'text-fg',
                    )}
                  >
                    {dayNumber(d)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex">
            {/* Hours */}
            <div className="relative w-14 shrink-0" style={{ height: GRID_HEIGHT }} aria-hidden="true">
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) =>
                i === 0 ? null : (
                  <span key={i} className="absolute right-2 -translate-y-1/2 text-xs text-muted" style={{ top: i * HOUR_PX }}>
                    {String(START_HOUR + i).padStart(2, '0')}:00
                  </span>
                ),
              )}
            </div>

            {days.map((d) => (
              <DayColumn
                key={d}
                day={d}
                tz={tz}
                isToday={d === today}
                nowMinutes={d === today ? nowMinutes : null}
                canBook={Boolean(canBook)}
                loaded={loaded}
                appointments={appointments.filter((a) => a.status !== 'cancelled' && dayOf(a.startAt, tz) === d)}
                onSlotClick={onSlotClick}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted" aria-label="Colour key">
        {(['scheduled', 'confirmed', 'completed', 'no_show'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-full', APPOINTMENT_STATUS[s].dot)} />
            {APPOINTMENT_STATUS[s].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <Icon name="box" size={13} /> Paid by a package
        </li>
      </ul>

      {selected && (
        <AppointmentModal
          appointment={selected}
          tz={tz}
          onClose={closeSelected}
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

function DayColumn({
  day,
  tz,
  isToday,
  nowMinutes,
  canBook,
  loaded,
  appointments,
  onSlotClick,
  onSelect,
}: {
  day: string;
  tz: string;
  isToday: boolean;
  nowMinutes: number | null;
  canBook: boolean;
  loaded: boolean;
  appointments: Appointment[];
  onSlotClick: (day: string, offsetY: number) => void;
  onSelect: (a: Appointment) => void;
}) {
  const nowTop = nowMinutes !== null && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 ? ((nowMinutes - START_HOUR * 60) / 60) * HOUR_PX : null;
  return (
    <div
      className={cn('relative flex-1 border-l border-line', isToday && 'bg-primary-soft/25', canBook && 'cursor-pointer')}
      style={{
        height: GRID_HEIGHT,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--c-line) ${HOUR_PX - 1}px, var(--c-line) ${HOUR_PX}px)`,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSlotClick(day, e.clientY - e.currentTarget.getBoundingClientRect().top);
      }}
    >
      {nowTop !== null && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-hidden="true">
          <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-bad" />
          <span className="h-px flex-1 bg-bad" />
        </div>
      )}

      {loaded && appointments.length === 0 && isToday && (
        <p className="pointer-events-none absolute inset-x-0 top-6 px-4 text-center text-sm text-muted">No appointments yet today.</p>
      )}

      {appointments.map((a) => {
        const startMin = Math.max(minutesOfDay(a.startAt, tz), START_HOUR * 60);
        const endRaw = dayOf(a.endAt, tz) === day ? minutesOfDay(a.endAt, tz) : END_HOUR * 60;
        const endMin = Math.min(endRaw, END_HOUR * 60);
        const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 26);
        const compact = height < 44;
        const st = APPOINTMENT_STATUS[a.status];
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            className={cn(
              'absolute inset-x-1 cursor-pointer overflow-hidden rounded-md border-l-4 px-2 text-left text-xs shadow-sm transition-shadow hover:shadow-md',
              compact ? 'flex items-center gap-1.5 py-0' : 'py-1',
              st.block,
            )}
            style={{ top: top + 1, height: height - 2 }}
            aria-label={`${a.clientName}, ${a.serviceName}, ${timeOf(a.startAt, tz)} to ${timeOf(a.endAt, tz)}, ${st.label}${a.clientPackageId ? ', package' : ''}`}
          >
            {compact ? (
              <>
                <span className="font-semibold">{timeOf(a.startAt, tz)}</span>
                <span className="truncate font-medium">{a.clientName}</span>
                {a.clientPackageId && <Icon name="box" size={12} className="shrink-0 opacity-80" />}
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 truncate font-semibold">
                  {a.clientName}
                  {a.clientPackageId && <Icon name="box" size={12} className="shrink-0 opacity-80" />}
                </span>
                <span className="block truncate opacity-90">
                  {timeOf(a.startAt, tz)} · {a.serviceName}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
