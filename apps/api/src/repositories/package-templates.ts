import type {
  PackageTemplate,
  PackageTemplateInput,
  PackageTemplateUpdate,
} from '@deeclinic/shared';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS =
  'id, name, service_id, session_count, price_usd, validity_days, is_active, created_at, services(name)';

interface Row {
  id: string;
  name: string;
  service_id: string;
  session_count: number;
  price_usd: number | string;
  validity_days: number;
  is_active: boolean;
  created_at: string;
  services: { name: string } | null;
}

const toModel = (r: Row): PackageTemplate => ({
  id: r.id,
  name: r.name,
  serviceId: r.service_id,
  serviceName: r.services?.name ?? '',
  sessionCount: r.session_count,
  priceUsd: Number(r.price_usd),
  validityDays: r.validity_days,
  isActive: r.is_active,
  createdAt: r.created_at,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listTemplates(includeInactive: boolean): Promise<PackageTemplate[]> {
  let q = getSupabase().from('package_templates').select(COLUMNS).order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Row[]).map(toModel);
}

export async function getTemplate(id: string): Promise<PackageTemplate | null> {
  const { data, error } = await getSupabase()
    .from('package_templates')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}

export async function createTemplate(input: PackageTemplateInput): Promise<PackageTemplate> {
  const { data, error } = await getSupabase()
    .from('package_templates')
    .insert({
      name: input.name,
      service_id: input.serviceId,
      session_count: input.sessionCount,
      price_usd: round2(input.priceUsd),
      validity_days: input.validityDays,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toModel(data as unknown as Row);
}

export async function updateTemplate(
  id: string,
  patch: PackageTemplateUpdate,
): Promise<PackageTemplate | null> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.serviceId !== undefined) row.service_id = patch.serviceId;
  if (patch.sessionCount !== undefined) row.session_count = patch.sessionCount;
  if (patch.priceUsd !== undefined) row.price_usd = round2(patch.priceUsd);
  if (patch.validityDays !== undefined) row.validity_days = patch.validityDays;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { data, error } = await getSupabase()
    .from('package_templates')
    .update(row)
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}
