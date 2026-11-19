import { logger } from './logger.js';
import { getSupabase } from './supabase.js';

interface AuditEntry {
  /** null for events with no signed-in user, such as a failed login */
  actorId: string | null;
  action: string; // for example 'clinic_settings.update'
  entity: string; // table name
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

const toRow = (e: AuditEntry) => ({
  actor_id: e.actorId,
  action: e.action,
  entity: e.entity,
  entity_id: e.entityId ?? null,
  before_data: e.before ?? null,
  after_data: e.after ?? null,
});

/** Writes many audit rows at once, for bulk operations such as an import. */
export async function writeAuditBatch(entries: AuditEntry[]): Promise<void> {
  for (let i = 0; i < entries.length; i += 500) {
    const { error } = await getSupabase()
      .from('audit_logs')
      .insert(entries.slice(i, i + 500).map(toRow));
    if (error) throw error;
  }
}

/** For security events that must be recorded but must not break the request they describe. */
export async function writeAuditQuietly(entry: AuditEntry): Promise<void> {
  try {
    await writeAudit(entry);
  } catch (err) {
    logger.error({ err, action: entry.action }, 'Could not write audit entry');
  }
}

/** Every write records who did what. Failing to write the log fails the request. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await getSupabase().from('audit_logs').insert(toRow(entry));
  if (error) throw error;
}
