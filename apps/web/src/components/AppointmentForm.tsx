'use client';

import { formatUsd, type Appointment, type Client, type ClientPackage, type ClientPage, type Service } from '@deeclinic/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, Alert, Button, Field, Input, Select, Textarea, cn } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { api, ApiError, describeError, newKey } from '@/lib/api';
import { dayOf, formatDateTime, lastValidDay, timeOf, zonedToUtc } from '@/lib/time';

type PickedClient = Pick<Client, 'id' | 'fullName' | 'phoneE164'>;

interface Props {
  tz: string;
  /** Present when rescheduling or editing */
  appointment?: Appointment;
  /** Prefill for a new booking, in the clinic timezone */
  initial?: { date: string; time: string };
  /** Skip the client search, for bookings started from a client's page */
  presetClient?: PickedClient;
  onSaved: () => void;
  onCancel: () => void;
}

export function AppointmentForm({ tz, appointment, initial, presetClient, onSaved, onCancel }: Props) {
  const editing = Boolean(appointment);
  // One key per form, so a retried submit can't create a second booking
  const [idempotencyKey] = useState(newKey);

  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '');
  const [date, setDate] = useState(appointment ? dayOf(appointment.startAt, tz) : (initial?.date ?? ''));
  const [time, setTime] = useState(appointment ? timeOf(appointment.startAt, tz) : (initial?.time ?? '09:00'));
  const [notes, setNotes] = useState(appointment?.notes ?? '');

  const [client, setClient] = useState<PickedClient | null>(
    appointment
      ? { id: appointment.clientId, fullName: appointment.clientName, phoneE164: appointment.clientPhone }
      : (presetClient ?? null),
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

  // Client search, after the person stops typing
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
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Client */}
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-fg">Client</span>
        {client ? (
          <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface px-3 py-2.5">
            <Avatar name={client.fullName} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{client.fullName}</p>
              <p className="truncate text-xs text-muted">{client.phoneE164}</p>
            </div>
            {!editing && !presetClient && (
              <button
                type="button"
                onClick={() => {
                  setClient(null);
                  setSearch('');
                  setResults([]);
                  setSearched(false);
                }}
                className="text-sm font-medium text-primary-ink hover:underline"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input
                aria-label="Search clients by name or phone"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearched(false);
                }}
                placeholder="Search by name or phone"
                className="pl-9"
                data-autofocus
              />
            </div>
            {searched && results.length === 0 && (
              <p className="text-sm text-muted">
                No client found.{' '}
                <Link href="/clients/new" className="font-medium text-primary-ink hover:underline">
                  Add a new client
                </Link>
              </p>
            )}
            {results.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setClient(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken">
                      <Avatar name={c.fullName} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">{c.fullName}</span>
                        <span className="block truncate text-xs text-muted">{c.phoneE164}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Service */}
      <Field
        label="Service"
        htmlFor="service"
        hint={appointment?.clientPackageId ? 'This visit is booked on a package, so its service cannot change.' : undefined}
      >
        <Select
          id="service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          disabled={Boolean(appointment?.clientPackageId)}
        >
          <option value="">{services === null ? 'Loading…' : 'Choose a service'}</option>
          {(services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.durationMinutes} min · {formatUsd(s.priceUsd)}
            </option>
          ))}
        </Select>
        {services?.length === 0 && (
          <p className="mt-1.5 text-sm text-warn-ink">
            No services yet.{' '}
            <Link href="/services" className="font-medium underline">
              Add a service
            </Link>{' '}
            first.
          </p>
        )}
      </Field>

      {/* Package or pay separately */}
      {eligible.length > 0 && (
        <fieldset className="space-y-2 rounded-lg border border-line bg-sunken/50 p-3">
          <legend className="px-1 text-sm font-medium text-fg">Payment for this visit</legend>
          {eligible.map((p) => (
            <label
              key={p.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 text-sm',
                chosenPackageId === p.id ? 'border-primary' : 'border-line',
              )}
            >
              <input type="radio" name="pkg" checked={chosenPackageId === p.id} onChange={() => setPackageChoice(p.id)} className="mt-0.5 accent-(--c-primary)" />
              <span>
                <span className="block font-medium text-fg">Use the package: {p.name}</span>
                <span className="block text-xs text-muted">
                  {p.sessionsAvailableToBook} session{p.sessionsAvailableToBook === 1 ? '' : 's'} left to book · valid until {lastValidDay(p.expiresAt, tz)}
                </span>
              </span>
            </label>
          ))}
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 text-sm',
              chosenPackageId === '' ? 'border-primary' : 'border-line',
            )}
          >
            <input type="radio" name="pkg" checked={chosenPackageId === ''} onChange={() => setPackageChoice('')} className="mt-0.5 accent-(--c-primary)" />
            <span className="font-medium text-fg">Pay for this visit separately{service && ` (${formatUsd(service.priceUsd)})`}</span>
          </label>
        </fieldset>
      )}

      {/* When */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="date">
          <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start time" htmlFor="time">
          <Input id="time" type="time" step={300} required value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      {endPreview && service && (
        <p className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={15} /> Ends at <strong className="text-fg">{endPreview}</strong> ({service.durationMinutes} min)
          </span>
          <span>
            {usingPackage || appointment?.clientPackageId ? (
              <strong className="text-primary-ink">Covered by the package</strong>
            ) : (
              <>
                Price <strong className="text-fg">{formatUsd(service.priceUsd)}</strong>
              </>
            )}
          </span>
        </p>
      )}

      <Field label="Notes" htmlFor="notes" hint="Optional. Visible on the appointment, not sent to the client.">
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {error && <Alert tone="bad">{error}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Book appointment'}
        </Button>
      </div>
    </form>
  );
}
