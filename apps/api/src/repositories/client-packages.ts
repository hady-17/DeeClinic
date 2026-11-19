import type { ClientPackage, Currency, PackageStatus, PaymentMethod } from '@deeclinic/shared';
import { mapMoneyError, sumMoney } from '../lib/money.js';
import { getSupabase } from '../lib/supabase.js';

const COLUMNS = `id, client_id, template_id, service_id, sessions_total, price_usd, purchased_at, expires_at, status,
  package_templates(name), services(name), package_usages(id), appointments(status), payments(amount_usd, voided_at)`;

interface Row {
  id: string;
  client_id: string;
  template_id: string;
  service_id: string;
  sessions_total: number;
  price_usd: number | string;
  purchased_at: string;
  expires_at: string;
  status: PackageStatus;
  package_templates: { name: string } | null;
  services: { name: string } | null;
  package_usages: { id: string }[];
  appointments: { status: string }[];
  payments: { amount_usd: number | string; voided_at: string | null }[];
}

export function toPackage(r: Row, now = new Date()): ClientPackage {
  const used = r.package_usages.length;
  const remaining = Math.max(r.sessions_total - used, 0);
  // Visits already booked against the package and not yet done will each take a session
  const pendingVisits = r.appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed').length;
  const expired = r.status === 'active' && new Date(r.expires_at) <= now;
  const status: PackageStatus = expired ? 'expired' : r.status;
  return {
    id: r.id,
    clientId: r.client_id,
    templateId: r.template_id,
    name: r.package_templates?.name ?? '',
    serviceId: r.service_id,
    serviceName: r.services?.name ?? '',
    sessionsTotal: r.sessions_total,
    sessionsUsed: used,
    sessionsRemaining: remaining,
    sessionsAvailableToBook: status === 'active' ? Math.max(remaining - pendingVisits, 0) : 0,
    priceUsd: Number(r.price_usd),
    paidUsd: sumMoney(r.payments.filter((p) => !p.voided_at).map((p) => Number(p.amount_usd))),
    purchasedAt: new Date(r.purchased_at).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    status,
  };
}

export async function listClientPackages(clientId: string): Promise<ClientPackage[]> {
  const { data, error } = await getSupabase()
    .from('client_packages')
    .select(COLUMNS)
    .eq('client_id', clientId)
    .order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map((r) => toPackage(r));
}

export async function getClientPackage(id: string): Promise<ClientPackage | null> {
  const { data, error } = await getSupabase()
    .from('client_packages')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toPackage(data as unknown as Row) : null;
}

/** Creates the sale, and the first payment if there is one, in a single database transaction. */
export async function sellPackage(args: {
  clientId: string;
  templateId: string;
  recordedBy: string;
  payment?: { currency: Currency; amount: number; rate: number | null; amountUsd: number; method: PaymentMethod };
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('sell_package', {
    p_client_id: args.clientId,
    p_template_id: args.templateId,
    p_recorded_by: args.recordedBy,
    p_pay_currency: args.payment?.currency ?? null,
    p_pay_amount: args.payment?.amount ?? null,
    p_pay_rate: args.payment?.rate ?? null,
    p_pay_amount_usd: args.payment?.amountUsd ?? null,
    p_pay_method: args.payment?.method ?? 'cash',
  });
  if (error) mapMoneyError(error);
  return data as string;
}
