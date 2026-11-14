import type { VisitNote, VisitNoteUpdate } from '@deeclinic/shared';
import { getSupabase } from '../lib/supabase.js';

export const NOTE_COLUMNS =
  'id, client_id, appointment_id, body, products_used, created_at, updated_at';

export interface NoteRow {
  id: string;
  client_id: string;
  appointment_id: string | null;
  body: string;
  products_used: string | null;
  created_at: string;
  updated_at: string;
}

export const toNote = (r: NoteRow): VisitNote => ({
  id: r.id,
  clientId: r.client_id,
  appointmentId: r.appointment_id,
  body: r.body,
  productsUsed: r.products_used,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listNotes(appointmentId: string): Promise<VisitNote[]> {
  const { data, error } = await getSupabase()
    .from('visit_notes')
    .select(NOTE_COLUMNS)
    .eq('appointment_id', appointmentId)
    .order('created_at');
  if (error) throw error;
  return (data as NoteRow[]).map(toNote);
}

export async function getNote(id: string): Promise<VisitNote | null> {
  const { data, error } = await getSupabase()
    .from('visit_notes')
    .select(NOTE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toNote(data as NoteRow) : null;
}

export async function createNote(row: {
  clientId: string;
  appointmentId: string;
  body: string;
  productsUsed: string | null;
  createdBy: string;
}): Promise<VisitNote> {
  const { data, error } = await getSupabase()
    .from('visit_notes')
    .insert({
      client_id: row.clientId,
      appointment_id: row.appointmentId,
      body: row.body,
      products_used: row.productsUsed,
      created_by: row.createdBy,
    })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return toNote(data as NoteRow);
}

export async function updateNote(id: string, patch: VisitNoteUpdate): Promise<VisitNote | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.productsUsed !== undefined) row.products_used = patch.productsUsed;
  const { data, error } = await getSupabase()
    .from('visit_notes')
    .update(row)
    .eq('id', id)
    .select(NOTE_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toNote(data as NoteRow) : null;
}
