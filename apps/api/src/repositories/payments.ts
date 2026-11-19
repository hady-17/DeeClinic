import type { Currency, Payment, PaymentMethod } from '@deeclinic/shared';
import { mapMoneyError } from '../lib/money.js';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS = `id, client_id, appointment_id, client_package_id, currency, amount, exchange_rate_lbp_per_usd,
  amount_usd, method, paid_at, voided_at, void_reason,
  appointments(services(name)), client_packages(package_templates(name))`;

interface Row {
  id: string;
  client_id: string;
  appointment_id: string | null;
  client_package_id: string | null;
  currency: Currency;
  amount: number | string;
  exchange_rate_lbp_per_usd: number | string | null;
  amount_usd: number | string;
  method: PaymentMethod;
  paid_at: string;
  voided_at: string | null;
  void_reason: string | null;
  appointments: { services: { name: string } | null } | null;
  client_packages: { package_templates: { name: string } | null } | null;
}

const toModel = (r: Row): Payment => ({
  id: r.id,
  clientId: r.client_id,
  appointmentId: r.appointment_id,
  clientPackageId: r.client_package_id,
  forLabel: r.client_package_id
    ? `Package: ${r.client_packages?.package_templates?.name ?? ''}`
    : (r.appointments?.services?.name ?? 'Visit'),
  currency: r.currency,
  amount: Number(r.amount),
  exchangeRate: r.exchange_rate_lbp_per_usd === null ? null : Number(r.exchange_rate_lbp_per_usd),
  amountUsd: Number(r.amount_usd),
  method: r.method,
  paidAt: new Date(r.paid_at).toISOString(),
  voidedAt: r.voided_at ? new Date(r.voided_at).toISOString() : null,
  voidReason: r.void_reason,
});

export async function listPayments(filter: {
  clientId?: string;
  appointmentId?: string;
  clientPackageId?: string;
}): Promise<Payment[]> {
  let q = getSupabase().from('payments').select(COLUMNS).order('paid_at', { ascending: false }).limit(500);
  if (filter.clientId) q = q.eq('client_id', filter.clientId);
  if (filter.appointmentId) q = q.eq('appointment_id', filter.appointmentId);
  if (filter.clientPackageId) q = q.eq('client_package_id', filter.clientPackageId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Row[]).map(toModel);
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await getSupabase().from('payments').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}

/** Runs the record_payment database function, which locks the target and refuses overpayment. */
export async function recordPayment(args: {
  appointmentId?: string;
  clientPackageId?: string;
  currency: Currency;
  amount: number;
  rate: number | null;
  amountUsd: number;
  method: PaymentMethod;
  recordedBy: string;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('record_payment', {
    p_appointment_id: args.appointmentId ?? null,
    p_client_package_id: args.clientPackageId ?? null,
    p_currency: args.currency,
    p_amount: args.amount,
    p_rate: args.rate,
    p_amount_usd: args.amountUsd,
    p_method: args.method,
    p_recorded_by: args.recordedBy,
  });
  if (error) mapMoneyError(error);
  return data as string;
}

/** Marks a payment void. Nothing is ever deleted. Returns null if it was already void or is missing. */
export async function voidPayment(id: string, reason: string): Promise<Payment | null> {
  const { data, error } = await getSupabase()
    .from('payments')
    .update({ voided_at: new Date().toISOString(), void_reason: reason })
    .eq('id', id)
    .is('voided_at', null)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? toModel(data as unknown as Row) : null;
}
