import type { Appointment, AppointmentStatus, ClientHistoryEntry } from '@deeclinic/shared';
import { AppError } from '../lib/errors.js';
import { getSupabase } from '../lib/supabase.js';
import { NOTE_COLUMNS, toNote, type NoteRow } from './visit-notes.js';

const COLUMNS =
  'id, client_id, service_id, client_package_id, start_at, end_at, status, price_usd, notes, created_at, updated_at, clients(full_name, phone_e164), services(name)';

interface Row {
  id: string;
  client_id: string;
  service_id: string;
  client_package_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  price_usd: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients: { full_name: string; phone_e164: string } | null;
  services: { name: string } | null;
}

const iso = (s: string) => new Date(s).toISOString();

const toModel = (r: Row): Appointment => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.clients?.full_name ?? '',
  clientPhone: r.clients?.phone_e164 ?? '',
  serviceId: r.service_id,
  serviceName: r.services?.name ?? '',
  clientPackageId: r.client_package_id,
  startAt: iso(r.start_at),
  endAt: iso(r.end_at),
  status: r.status,
  priceUsd: Number(r.price_usd),
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** The exclusion constraint (SQLSTATE 23P01) becomes a 409 that names the clash. */
async function rethrowOverlap(
  error: { code?: string },
  startAt: string,
  endAt: string,
  excludeId?: string,
): Promise<never> {
  if (error.code === '23P01') {
    let q = getSupabase()
      .from('appointments')
      .select('start_at, end_at')
      .in('status', ['scheduled', 'confirmed', 'completed'])
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .order('start_at')
      .limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    const clash = data?.[0];
    throw AppError.conflict('APPOINTMENT_CONFLICT', 'This time overlaps another appointment.', {
      conflictsWith: clash ? iso(clash.start_at as string) : null,
      conflictsUntil: clash ? iso(clash.end_at as string) : null,
    });
  }
  throw error;
}

export async function listAppointments(from: string, to: string): Promise<Appointment[]> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select(COLUMNS)
    .lt('start_at', to)
    .gt('end_at', from)
    .neq('status', 'cancelled')
    .order('start_at');
  if (error) throw error;
  return (data as unknown as Row[]).map(toModel);
}

/** A client's visits, newest first, each with its notes. */
export async function listClientHistory(
  clientId: string,
  limit: number,
): Promise<ClientHistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select(`${COLUMNS}, visit_notes(${NOTE_COLUMNS})`)
    .eq('client_id', clientId)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: false })
    .order('created_at', { referencedTable: 'visit_notes' })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as (Row & { visit_notes: NoteRow[] })[]).map((r) => ({
    ...toModel(r),
    visitNotes: r.visit_notes.map(toNote),
  }));
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}

export async function insertAppointment(row: {
  clientId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  priceUsd: number;
  notes: string | null;
  createdBy: string;
  clientPackageId?: string | null;
}): Promise<Appointment> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .insert({
      client_id: row.clientId,
      service_id: row.serviceId,
      client_package_id: row.clientPackageId ?? null,
      start_at: row.startAt,
      end_at: row.endAt,
      price_usd: row.priceUsd,
      notes: row.notes,
      created_by: row.createdBy,
    })
    .select(COLUMNS)
    .single();
  if (error) return rethrowOverlap(error, row.startAt, row.endAt);
  return toModel(data as unknown as Row);
}

export async function patchAppointment(
  id: string,
  row: { serviceId?: string; startAt?: string; endAt?: string; priceUsd?: number; notes?: string | null },
  window: { startAt: string; endAt: string },
): Promise<Appointment | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (row.serviceId !== undefined) update.service_id = row.serviceId;
  if (row.startAt !== undefined) update.start_at = row.startAt;
  if (row.endAt !== undefined) update.end_at = row.endAt;
  if (row.priceUsd !== undefined) update.price_usd = row.priceUsd;
  if (row.notes !== undefined) update.notes = row.notes;

  const { data, error } = await getSupabase()
    .from('appointments')
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return rethrowOverlap(error, window.startAt, window.endAt, id);
  return data ? toModel(data as unknown as Row) : null;
}

export async function setStatus(
  id: string,
  from: AppointmentStatus[],
  status: 'no_show' | 'cancelled',
): Promise<Appointment | null> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', from)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}

/**
 * Marks a no-show. When the clinic's rule says a no-show uses a session, one is taken from
 * the client's package (if any are left). Returns whether a session was used.
 */
export async function markNoShow(id: string, consumeSession: boolean): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('mark_no_show', {
    p_appointment_id: id,
    p_consume_session: consumeSession,
  });
  if (!error) return Boolean(data);
  const msg = error.message ?? '';
  if (msg.includes('APPOINTMENT_NOT_FOUND')) throw AppError.notFound('Appointment not found.');
  if (msg.includes('INVALID_STATUS_TRANSITION')) {
    throw AppError.businessRule('This appointment can no longer be changed.');
  }
  throw error;
}

/** Runs the complete_appointment database function and maps its errors. */
export async function completeAppointment(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('complete_appointment', { p_appointment_id: id });
  if (!error) return;
  const msg = error.message ?? '';
  if (msg.includes('APPOINTMENT_NOT_FOUND')) throw AppError.notFound('Appointment not found.');
  if (msg.includes('NO_SESSIONS_REMAINING')) {
    throw AppError.businessRule('This package has no sessions remaining.');
  }
  if (msg.includes('INVALID_STATUS_TRANSITION')) {
    throw AppError.businessRule('This appointment can no longer be completed.');
  }
  throw error;
}
