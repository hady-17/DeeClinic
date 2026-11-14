import type { ClinicSettings, ClinicSettingsInput } from '@deeclinic/shared';
import { getSupabase } from '../lib/supabase.js';

interface Row {
  name: string;
  phone_e164: string | null;
  address: string | null;
  timezone: string;
  reminder_send_time: string; // 'HH:MM:SS' from Postgres
  updated_at: string;
}

const toModel = (r: Row): ClinicSettings => ({
  name: r.name,
  phoneE164: r.phone_e164,
  address: r.address,
  timezone: r.timezone,
  reminderSendTime: r.reminder_send_time.slice(0, 5),
  updatedAt: r.updated_at,
});

export async function getClinicSettings(): Promise<ClinicSettings | null> {
  const { data, error } = await getSupabase()
    .from('clinic_settings')
    .select('name, phone_e164, address, timezone, reminder_send_time, updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as Row) : null;
}

export async function saveClinicSettings(input: ClinicSettingsInput): Promise<ClinicSettings> {
  const { data, error } = await getSupabase()
    .from('clinic_settings')
    .upsert({
      id: 1,
      name: input.name,
      phone_e164: input.phoneE164,
      address: input.address,
      timezone: input.timezone,
      reminder_send_time: input.reminderSendTime,
      updated_at: new Date().toISOString(),
    })
    .select('name, phone_e164, address, timezone, reminder_send_time, updated_at')
    .single();
  if (error) throw error;
  return toModel(data as Row);
}
