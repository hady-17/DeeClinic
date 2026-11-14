import type { Service, ServiceInput, ServiceUpdate } from '@deeclinic/shared';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS =
  'id, name, category, duration_minutes, price_usd, follow_up_interval_days, is_active, created_at, updated_at';

interface Row {
  id: string;
  name: string;
  category: Service['category'];
  duration_minutes: number;
  price_usd: number | string;
  follow_up_interval_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const toModel = (r: Row): Service => ({
  id: r.id,
  name: r.name,
  category: r.category,
  durationMinutes: r.duration_minutes,
  priceUsd: Number(r.price_usd),
  followUpIntervalDays: r.follow_up_interval_days,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listServices(includeInactive: boolean): Promise<Service[]> {
  let q = getSupabase().from('services').select(COLUMNS).order('category').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(toModel);
}

export async function getService(id: string): Promise<Service | null> {
  const { data, error } = await getSupabase()
    .from('services')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as Row) : null;
}

export async function createService(input: ServiceInput): Promise<Service> {
  const { data, error } = await getSupabase()
    .from('services')
    .insert({
      name: input.name,
      category: input.category,
      duration_minutes: input.durationMinutes,
      price_usd: round2(input.priceUsd),
      follow_up_interval_days: input.followUpIntervalDays,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toModel(data as Row);
}

export async function updateService(id: string, patch: ServiceUpdate): Promise<Service | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.durationMinutes !== undefined) row.duration_minutes = patch.durationMinutes;
  if (patch.priceUsd !== undefined) row.price_usd = round2(patch.priceUsd);
  if (patch.followUpIntervalDays !== undefined) row.follow_up_interval_days = patch.followUpIntervalDays;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { data, error } = await getSupabase()
    .from('services')
    .update(row)
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as Row) : null;
}
