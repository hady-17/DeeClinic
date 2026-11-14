import { getSupabase } from './supabase.js';

interface AuditEntry {
  actorId: string;
  action: string; // for example 'clinic_settings.update'
  entity: string; // table name
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Every write records who did what. Failing to write the log fails the request. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await getSupabase()
    .from('audit_logs')
    .insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      before_data: entry.before ?? null,
      after_data: entry.after ?? null,
    });
  if (error) throw error;
}
