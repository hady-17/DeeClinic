'use client';

import type { Appointment, ClinicSettings } from '@deeclinic/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentDetails } from '@/components/AppointmentDetails';
import { AppointmentForm } from '@/components/AppointmentForm';
import { Modal } from '@/components/Modal';
import { api } from '@/lib/api';
import {
  DEFAULT_TZ,
  addDays,
  dayOf,
  dayRangeUtc,
  formatDayLong,
  formatDayShort,
  minutesOfDay,
  timeOf,
  todayStr,
  weekStart,
} from '@/lib/time';

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 56;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

type View = 'day' | 'week';
type Dialog =
  | { type: 'create'; date: string; time: string }
  | { type: 'details'; appointment: Appointment }
  | { type: 'edit'; appointment: Appointment }
  | null;

const STATUS_STYLE: Record<Appointment['status'], string> = {
  scheduled: 'border-sky-400 bg-sky-100 text-sky-950',
  confirmed: 'border-indigo-400 bg-indigo-100 text-indigo-950',
  completed: 'border-emerald-400 bg-emerald-100 text-emerald-950',
  no_show: 'border-red-300 bg-red-50 text-red-900 opacity-80',
  cancelled: 'hidden',
};

export default function CalendarPage() {
  const [tz, setTz] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<View>('day');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the calendar.'));
    return () => {
      cancelled = true;
    };
  }, [tz, days, reloadKey]);

  const closeDialog = useCallback(() => setDialog(null), []);
  const refresh = useCallback(() => {
    setDialog(null);
    setReloadKey((k) => k + 1);
  }, []);

  if (!tz || !day) {
    return <main className="px-4 py-8 text-stone-500">Loading…</main>;
  }

  const step = view === 'day' ? 1 : 7;
  const today = todayStr(tz);
  const title = view === 'day' ? formatDayLong(day) : `${formatDayShort(days[0]!)} – ${formatDayShort(days[6]!)}`;

  function onSlotClick(d: string, offsetY: number) {
    const minutes = Math.round(((offsetY / HOUR_PX) * 60) / 15) * 15 + START_HOUR * 60;
    const clamped = Math.min(Math.max(minutes, START_HOUR * 60), END_HOUR * 60 - 15);
    const time = `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
    setDialog({ type: 'create', date: d, time });
  }

  const btn = 'rounded-md border border-stone-300 px-3 py-1.5 text-sm';

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm underline">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setDialog({ type: 'create', date: day, time: '09:00' })}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
          >
            New appointment
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous" onClick={() => setDay(addDays(day, -step))} className={btn}>
            ‹
          </button>
          <button type="button" onClick={() => setDay(today)} className={btn}>
            Today
          </button>
          <button type="button" aria-label="Next" onClick={() => setDay(addDays(day, step))} className={btn}>
            ›
          </button>
          <h2 className="ml-2 font-medium" aria-live="polite">{title}</h2>
        </div>
        <div className="flex overflow-hidden rounded-md border border-stone-300 text-sm" role="group" aria-label="View">
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 ${view === v ? 'bg-stone-900 text-white' : 'bg-white'}`}
            >
              {v === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <div style={{ minWidth: view === 'week' ? 760 : undefined }}>
          <div className="flex border-b border-stone-200 text-sm">
            <div className="w-14 shrink-0" />
            {days.map((d) => (
              <div key={d} className={`flex-1 px-2 py-2 text-center font-medium ${d === today ? 'bg-amber-50' : ''}`}>
                {formatDayShort(d)}
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="relative w-14 shrink-0" style={{ height: GRID_HEIGHT }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <span
                  key={i}
                  className="absolute right-2 -translate-y-1/2 text-xs text-stone-500"
                  style={{ top: i * HOUR_PX, display: i === 0 ? 'none' : undefined }}
                >
                  {String(START_HOUR + i).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {days.map((d) => (
              <DayColumn
                key={d}
                day={d}
                tz={tz}
                isToday={d === today}
                appointments={appointments.filter((a) => a.status !== 'cancelled' && dayOf(a.startAt, tz) === d)}
                onSlotClick={onSlotClick}
                onSelect={(appointment) => setDialog({ type: 'details', appointment })}
              />
            ))}
          </div>
        </div>
      </div>

      {dialog?.type === 'create' && (
        <Modal title="New appointment" onClose={closeDialog}>
          <AppointmentForm tz={tz} initial={{ date: dialog.date, time: dialog.time }} onSaved={refresh} onCancel={closeDialog} />
        </Modal>
      )}
      {dialog?.type === 'edit' && (
        <Modal title="Reschedule appointment" onClose={closeDialog}>
          <AppointmentForm tz={tz} appointment={dialog.appointment} onSaved={refresh} onCancel={closeDialog} />
        </Modal>
      )}
      {dialog?.type === 'details' && (
        <Modal title="Appointment" onClose={closeDialog}>
          <AppointmentDetails
            appointment={dialog.appointment}
            tz={tz}
            onChanged={refresh}
            onEdit={() => setDialog({ type: 'edit', appointment: dialog.appointment })}
          />
        </Modal>
      )}
    </main>
  );
}

function DayColumn({
  day,
  tz,
  isToday,
  appointments,
  onSlotClick,
  onSelect,
}: {
  day: string;
  tz: string;
  isToday: boolean;
  appointments: Appointment[];
  onSlotClick: (day: string, offsetY: number) => void;
  onSelect: (a: Appointment) => void;
}) {
  return (
    <div
      className={`relative flex-1 border-l border-stone-200 ${isToday ? 'bg-amber-50/40' : ''}`}
      style={{
        height: GRID_HEIGHT,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #e7e5e4 ${HOUR_PX - 1}px, #e7e5e4 ${HOUR_PX}px)`,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSlotClick(day, e.clientY - e.currentTarget.getBoundingClientRect().top);
        }
      }}
    >
      {appointments.map((a) => {
        const startMin = Math.max(minutesOfDay(a.startAt, tz), START_HOUR * 60);
        const endRaw = dayOf(a.endAt, tz) === day ? minutesOfDay(a.endAt, tz) : END_HOUR * 60;
        const endMin = Math.min(endRaw, END_HOUR * 60);
        const top = ((startMin - START_HOUR * 60) / 60) * HOUR_PX;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 22);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            className={`absolute inset-x-0.5 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm ${STATUS_STYLE[a.status]}`}
            style={{ top, height }}
            aria-label={`${a.clientName}, ${a.serviceName}, ${timeOf(a.startAt, tz)} to ${timeOf(a.endAt, tz)}, ${a.status.replace('_', ' ')}`}
          >
            <span className="block truncate font-medium">{a.clientName}</span>
            <span className="block truncate">
              {timeOf(a.startAt, tz)} · {a.serviceName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
