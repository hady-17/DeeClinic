'use client';

import type { Appointment, Client, ClientPackage, ClientPage, Service } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, describeError, newKey } from '@/lib/api';
import { dayOf, formatDateTime, lastValidDay, timeOf, zonedToUtc } from '@/lib/time';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface Props {
  tz: string;
  /** Present when rescheduling or editing */
  appointment?: Appointment;
  /** Prefill for a new booking, in the clinic timezone */
  initial?: { date: string; time: string };
  onSaved: () => void;
  onCancel: () => void;
}

export function AppointmentForm({ tz, appointment, initial, onSaved, onCancel }: Props) {
  const editing = Boolean(appointment);
  // One key per form, so a retried submit can't create a second booking
  const [idempotencyKey] = useState(newKey);

  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '');
  const [date, setDate] = useState(appointment ? dayOf(appointment.startAt, tz) : (initial?.date ?? ''));
  const [time, setTime] = useState(appointment ? timeOf(appointment.startAt, tz) : (initial?.time ?? '09:00'));
  const [notes, setNotes] = useState(appointment?.notes ?? '');

  const [client, setClient] = useState<Pick<Client, 'id' | 'fullName' | 'phoneE164'> | null>(
    appointment
      ? { id: appointment.clientId, fullName: appointment.clientName, phoneE164: appointment.clientPhone }
      : null,
  );
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searched, setSearched] = useState(false);

  // The client's packages. null in packageChoice means "not touched yet": use the first one that fits.
  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [packageChoice, setPackageChoice] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing || !client) return;
    let cancelled = false;
    api<{ data: ClientPackage[] }>(`/clients/${client.id}/packages`)
      .then((r) => !cancelled && setPackages(r.data))
      .catch(() => !cancelled && setPackages([]));
    return () => {
      cancelled = true;
    };
  }, [client, editing]);

  useEffect(() => {
    api<{ data: Service[] }>('/services')
      .then((r) => setServices(r.data))
      .catch((e) => {
        setServices([]);
        setError(describeError(e, 'Could not load services.'));
      });
  }, []);

  // Client search, after the owner stops typing
  useEffect(() => {
    if (editing || client || search.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api<ClientPage>(`/clients?limit=6&q=${encodeURIComponent(search.trim())}`)
        .then((r) => {
          if (cancelled) return;
          setResults(r.data);
          setSearched(true);
        })
        .catch((e) => {
          if (cancelled) return;
          setResults([]);
          setError(describeError(e, 'Could not search clients.'));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, client, editing]);

  const service = services?.find((s) => s.id === serviceId);

  // Packages that could pay for this visit: same client and service, still valid, a session free
  const eligible = editing
    ? []
    : packages.filter(
        (p) => p.clientId === client?.id && p.serviceId === serviceId && p.status === 'active' && p.sessionsAvailableToBook > 0,
      );
  const chosenPackageId = packageChoice === null ? (eligible[0]?.id ?? '') : packageChoice;
  const usingPackage = eligible.some((p) => p.id === chosenPackageId);

  const endPreview =
    service && date && time
      ? timeOf(new Date(zonedToUtc(date, time, tz).getTime() + service.durationMinutes * 60_000).toISOString(), tz)
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!client) return setError('Choose a client.');
    if (!serviceId) return setError('Choose a service.');
    if (!date || !time) return setError('Choose a date and time.');
    setSaving(true);
    const startAt = zonedToUtc(date, time, tz).toISOString();
    try {
      if (appointment) {
        await api(`/appointments/${appointment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ serviceId, startAt, notes }),
        });
      } else {
        await api('/appointments', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify({
            clientId: client.id,
            serviceId,
            startAt,
            notes,
            clientPackageId: usingPackage ? chosenPackageId : null,
          }),
        });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'APPOINTMENT_CONFLICT') {
        const d = err.details as { conflictsWith?: string; conflictsUntil?: string } | undefined;
        setError(
          d?.conflictsWith
            ? `This time overlaps another appointment (${formatDateTime(d.conflictsWith, tz)} to ${timeOf(d.conflictsUntil ?? d.conflictsWith, tz)}). Pick a different time.`
            : err.message,
        );
      } else {
        setError(describeError(err, 'Could not save the appointment.'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <span className="text-sm font-medium">Client</span>
        {client ? (
          <div className="flex items-center justify-between rounded-md border border-stone-300 px-3 py-2">
            <span>
              {client.fullName} <span className="text-sm text-stone-500">{client.phoneE164}</span>
            </span>
            {!editing && (
              <button type="button" onClick={() => { setClient(null); setSearch(''); setResults([]); setSearched(false); }} className="text-sm underline">
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              aria-label="Search clients by name or phone"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearched(false);
              }}
              placeholder="Search by name or phone"
              autoFocus
              className={field}
            />
            {searched && results.length === 0 && (
              <p className="text-sm text-stone-600">
                No client found.{' '}
                <Link href="/clients/new" className="underline">
                  Add a new client
                </Link>
              </p>
            )}
            {results.length > 0 && (
              <ul className="divide-y divide-stone-200 rounded-md border border-stone-200">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setClient(c)} className="w-full px-3 py-2 text-left hover:bg-stone-50">
                      {c.fullName} <span className="text-sm text-stone-500">{c.phoneE164}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="service" className="text-sm font-medium">Service</label>
        <select
          id="service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          disabled={Boolean(appointment?.clientPackageId)}
          className={field}
        >
          <option value="">{services === null ? 'Loading…' : 'Choose a service'}</option>
          {(services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.durationMinutes} min · {usd.format(s.priceUsd)}
            </option>
          ))}
        </select>
        {services?.length === 0 && (
          <p className="text-sm text-amber-800">
            No services yet.{' '}
            <Link href="/services" className="underline">
              Add a service
            </Link>{' '}
            first.
          </p>
        )}
        {appointment?.clientPackageId && (
          <p className="text-sm text-stone-600">This visit is booked on a package, so its service cannot change.</p>
        )}
      </div>

      {eligible.length > 0 && (
        <fieldset className="space-y-2 rounded-md border border-stone-200 p-3">
          <legend className="px-1 text-sm font-medium">Payment for this visit</legend>
          {eligible.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name="pkg" checked={chosenPackageId === p.id} onChange={() => setPackageChoice(p.id)} className="mt-1" />
              <span>
                Use the package <strong>{p.name}</strong>
                <span className="block text-stone-500">
                  {p.sessionsAvailableToBook} session{p.sessionsAvailableToBook === 1 ? '' : 's'} left to book · valid until {lastValidDay(p.expiresAt, tz)}
                </span>
              </span>
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="pkg" checked={chosenPackageId === ''} onChange={() => setPackageChoice('')} className="mt-1" />
            <span>Pay for this visit separately{service && ` (${usd.format(service.priceUsd)})`}</span>
          </label>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="date" className="text-sm font-medium">Date</label>
          <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="time" className="text-sm font-medium">Start time</label>
          <input id="time" type="time" step={300} required value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </div>
      </div>
      {endPreview && (
        <p className="text-sm text-stone-600">
          Ends at {endPreview}
          {service && (usingPackage || appointment?.clientPackageId ? ' · covered by the package' : ` · ${usd.format(service.priceUsd)}`)}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">Notes</label>
        <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Book appointment'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
