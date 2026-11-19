import type { ExchangeRate } from '@deeclinic/shared';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS = 'id, lbp_per_usd, effective_from, set_by, created_at, profiles(full_name)';

interface Row {
  id: string;
  lbp_per_usd: number | string;
  effective_from: string;
  set_by: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

const toModel = (r: Row): ExchangeRate => ({
  id: r.id,
  lbpPerUsd: Number(r.lbp_per_usd),
  effectiveFrom: new Date(r.effective_from).toISOString(),
  setBy: r.set_by,
  setByName: r.profiles?.full_name ?? null,
  createdAt: r.created_at,
});

/** The latest rate whose effective date has passed. */
export async function getCurrentRate(): Promise<ExchangeRate | null> {
  const { data, error } = await getSupabase()
    .from('exchange_rates')
    .select(COLUMNS)
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}

export async function listRates(limit = 100): Promise<ExchangeRate[]> {
  const { data, error } = await getSupabase()
    .from('exchange_rates')
    .select(COLUMNS)
    .order('effective_from', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as Row[]).map(toModel);
}

/** A change is always a new row. Rates are never edited. */
export async function insertRate(lbpPerUsd: number, setBy: string): Promise<ExchangeRate> {
  const { data, error } = await getSupabase()
    .from('exchange_rates')
    .insert({ lbp_per_usd: lbpPerUsd, set_by: setBy })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toModel(data as unknown as Row);
}
