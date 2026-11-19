import { getSupabase } from '../lib/supabase.js';

export async function getPasscode(userId: string): Promise<{ hash: string; updatedAt: string } | null> {
  const { data, error } = await getSupabase()
    .from('passcodes')
    .select('hash, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { hash: data.hash as string, updatedAt: new Date(data.updated_at as string).toISOString() } : null;
}

export async function savePasscode(userId: string, hash: string): Promise<void> {
  const { error } = await getSupabase()
    .from('passcodes')
    .upsert({ user_id: userId, hash, updated_at: new Date().toISOString() });
  if (error) throw error;
}
