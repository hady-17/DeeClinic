import type { Client, ClientInput, ClientPage, ClientUpdate } from '@deeclinic/shared';
import { AppError } from '../lib/errors.js';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS =
  'id, full_name, phone_e164, instagram_handle, email, source, whatsapp_consent_at, whatsapp_opt_out_at, notes, created_at, updated_at';

interface Row {
  id: string;
  full_name: string;
  phone_e164: string;
  instagram_handle: string | null;
  email: string | null;
  source: Client['source'];
  whatsapp_consent_at: string | null;
  whatsapp_opt_out_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const toModel = (r: Row): Client => ({
  id: r.id,
  fullName: r.full_name,
  phoneE164: r.phone_e164,
  instagramHandle: r.instagram_handle,
  email: r.email,
  source: r.source,
  whatsappConsentAt: r.whatsapp_consent_at,
  whatsappOptOutAt: r.whatsapp_opt_out_at,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Quotes a value for a PostgREST or() filter so commas and parentheses can't break it. */
const quote = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const encodeCursor = (name: string, id: string) =>
  Buffer.from(JSON.stringify([name, id])).toString('base64url');

function decodeCursor(cursor: string): [string, string] {
  try {
    const [name, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof name === 'string' && typeof id === 'string') return [name, id];
  } catch {
    // fall through
  }
  throw AppError.validation('Invalid cursor.');
}

/** Turns a unique-index violation on the phone number into a clear 409. */
async function rethrowDuplicate(error: { code?: string }, phone?: string): Promise<never> {
  if (error.code === '23505' && phone) {
    const { data } = await getSupabase()
      .from('clients')
      .select('id')
      .eq('phone_e164', phone)
      .is('deleted_at', null)
      .maybeSingle();
    throw AppError.conflict('CONFLICT', 'A client with this phone number already exists.', {
      field: 'phoneE164',
      existingClientId: data?.id ?? null,
    });
  }
  throw error;
}

export async function listClients(opts: {
  q?: string;
  cursor?: string;
  limit: number;
}): Promise<ClientPage> {
  let query = getSupabase()
    .from('clients')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('full_name')
    .order('id')
    .limit(opts.limit + 1);

  const term = opts.q?.replace(/[%_]/g, '').trim();
  if (term) {
    const parts = [`full_name.ilike.${quote(`%${term}%`)}`];
    const digits = term.replace(/\D/g, '');
    if (digits.length >= 3) parts.push(`phone_e164.ilike.${quote(`%${digits}%`)}`);
    query = query.or(parts.join(','));
  }

  if (opts.cursor) {
    const [name, id] = decodeCursor(opts.cursor);
    query = query.or(`full_name.gt.${quote(name)},and(full_name.eq.${quote(name)},id.gt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data as Row[];
  const page = rows.slice(0, opts.limit);
  const last = page[page.length - 1];
  return {
    data: page.map(toModel),
    nextCursor: rows.length > opts.limit && last ? encodeCursor(last.full_name, last.id) : null,
  };
}

/** Which of these phone numbers already belong to an active client. */
export async function findExistingPhones(phones: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < phones.length; i += 200) {
    const { data, error } = await getSupabase()
      .from('clients')
      .select('phone_e164')
      .in('phone_e164', phones.slice(i, i + 200))
      .is('deleted_at', null);
    if (error) throw error;
    for (const r of data) found.add(r.phone_e164 as string);
  }
  return found;
}

export interface BulkItem {
  row: number;
  input: ClientInput;
}

const toInsertRow = (input: ClientInput, consentAt: string) => ({
  full_name: input.fullName,
  phone_e164: input.phoneE164,
  instagram_handle: input.instagramHandle,
  email: input.email,
  source: input.source,
  whatsapp_consent_at: input.whatsappConsent ? consentAt : null,
  notes: input.notes,
});

/** Inserts in batches. If a batch is rejected, its rows are retried one by one. */
export async function insertClientsBulk(items: BulkItem[]) {
  const created: { row: number; id: string }[] = [];
  const failed: { row: number; reason: string }[] = [];
  const consentAt = new Date().toISOString();
  const supabase = getSupabase();

  for (let i = 0; i < items.length; i += 200) {
    const batch = items.slice(i, i + 200);
    const { data, error } = await supabase
      .from('clients')
      .insert(batch.map((b) => toInsertRow(b.input, consentAt)))
      .select('id');
    if (!error && data) {
      data.forEach((d, idx) => created.push({ row: batch[idx]!.row, id: d.id as string }));
      continue;
    }
    for (const item of batch) {
      const { data: one, error: oneError } = await supabase
        .from('clients')
        .insert(toInsertRow(item.input, consentAt))
        .select('id')
        .single();
      if (!oneError && one) created.push({ row: item.row, id: one.id as string });
      else {
        failed.push({
          row: item.row,
          reason:
            oneError?.code === '23505'
              ? 'A client with this phone number already exists.'
              : 'Could not save this row.',
        });
      }
    }
  }
  return { created, failed };
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await getSupabase()
    .from('clients')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as Row) : null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await getSupabase()
    .from('clients')
    .insert({
      full_name: input.fullName,
      phone_e164: input.phoneE164,
      instagram_handle: input.instagramHandle,
      email: input.email,
      source: input.source,
      whatsapp_consent_at: input.whatsappConsent ? new Date().toISOString() : null,
      notes: input.notes,
    })
    .select(COLUMNS)
    .single();
  if (error) return rethrowDuplicate(error, input.phoneE164);
  return toModel(data as Row);
}

export async function updateClient(
  id: string,
  patch: ClientUpdate,
  existing: Client,
): Promise<Client | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.phoneE164 !== undefined) row.phone_e164 = patch.phoneE164;
  if (patch.instagramHandle !== undefined) row.instagram_handle = patch.instagramHandle;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.whatsappConsent !== undefined) {
    // Keep the original consent date if consent was already recorded.
    row.whatsapp_consent_at = patch.whatsappConsent
      ? (existing.whatsappConsentAt ?? new Date().toISOString())
      : null;
  }

  const { data, error } = await getSupabase()
    .from('clients')
    .update(row)
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return rethrowDuplicate(error, patch.phoneE164);
  return data ? toModel(data as Row) : null;
}
