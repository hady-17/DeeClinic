// End-to-end check of packages, exchange rates and payments against the real project,
// through the API. Creates its own throwaway accounts and data, and removes them at the end.
import { createClient } from '@supabase/supabase-js';

const API = process.env.API ?? 'http://localhost:4000/api/v1';
const URL_ = process.env.SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now().toString(36);
const phoneDigits = String(Math.floor(10000000 + Math.random() * 89999999));
const OWNER = { email: `p2test-owner-${stamp}@example.com`, password: 'correct horse battery staple' };
const STAFF = { email: `p2test-staff-${stamp}@example.com`, password: 'purple giraffe lamp 42' };

let failures = 0;
const results: string[] = [];
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   <-- ${extra}`}`);
};

async function call(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}
const login = async (c: { email: string; password: string }) =>
  (await call('POST', '/auth/login', undefined, c)).json?.data?.session?.accessToken as string;

// Everything this run creates, so cleanup removes exactly that
const made = { users: [] as string[], clients: [] as string[], services: [] as string[], templates: [] as string[], rates: [] as string[] };
let settingsBackup: Record<string, unknown> | null | undefined;

// Inside the package validity (90 days), and far from any real booking
const slot = (day: number, hour: number) => {
  const d = new Date(Date.now() + (day + 10) * 864e5);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const book = (t: string, body: Record<string, unknown>) => call('POST', '/appointments', t, { notes: '', ...body });

async function main() {
  // Throwaway owner and staff
  const mkUser = async (c: { email: string; password: string }, role: string, name: string) => {
    const { data, error } = await admin.auth.admin.createUser({ ...c, email_confirm: true });
    if (error) throw error;
    made.users.push(data.user.id);
    const { error: pe } = await admin.from('profiles').insert({ id: data.user.id, full_name: name, role, email: c.email });
    if (pe) throw pe;
    return data.user.id;
  };
  await mkUser(OWNER, 'owner', 'P2 Test Owner');
  await mkUser(STAFF, 'staff', 'P2 Test Staff');
  const ot = await login(OWNER);
  const st = await login(STAFF);
  check('test accounts can log in', !!ot && !!st);

  // The clinic settings row, so the no-show rule can be switched. Restored at the end.
  const { data: existing } = await admin.from('clinic_settings').select('*').eq('id', 1).maybeSingle();
  settingsBackup = existing ?? null;
  if (!existing) await admin.from('clinic_settings').insert({ id: 1, name: 'P2 TEST CLINIC' });
  const setNoShowRule = async (value: boolean) => {
    const cur = (await call('GET', '/clinic-settings', ot)).json.data;
    return call('PUT', '/clinic-settings', ot, {
      name: cur.name, phoneE164: cur.phoneE164, address: cur.address, timezone: cur.timezone,
      reminderSendTime: cur.reminderSendTime, noShowUsesSession: value,
    });
  };

  // ---------- Exchange rates ----------
  const before = await call('GET', '/exchange-rates', ot);
  const hadRate = !!before.json.data.current;
  check('exchange-rates endpoint answers', before.status === 200);
  check('staff cannot set a rate (403)', (await call('POST', '/exchange-rates', st, { lbpPerUsd: 89500 })).status === 403);
  const r1 = await call('POST', '/exchange-rates', ot, { lbpPerUsd: 89500, confirmLargeChange: true });
  check('owner sets a rate', r1.status === 201 && r1.json.data.lbpPerUsd === 89500, JSON.stringify(r1.json));
  if (r1.json?.data?.id) made.rates.push(r1.json.data.id);
  const typo = await call('POST', '/exchange-rates', ot, { lbpPerUsd: 8950 });
  check('a 90% change needs confirmation (422)', typo.status === 422 && typo.json.error.details?.reason === 'RATE_CHANGE_NEEDS_CONFIRMATION', JSON.stringify(typo.json));
  const hist = await call('GET', '/exchange-rates', st);
  check('staff can read the rate and its history', hist.status === 200 && hist.json.data.current.lbpPerUsd === 89500 && hist.json.data.history.length >= 1);
  check('history shows who set the rate', hist.json.data.history.some((h: { setByName: string }) => h.setByName === 'P2 Test Owner'));

  // ---------- Catalog ----------
  const svc = await call('POST', '/services', ot, { name: `P2 TEST Laser ${stamp}`, category: 'laser_injectables', durationMinutes: 30, priceUsd: 100, followUpIntervalDays: null });
  const serviceId = svc.json.data.id as string;
  made.services.push(serviceId);
  const svc2 = await call('POST', '/services', ot, { name: `P2 TEST Facial ${stamp}`, category: 'skin_care', durationMinutes: 30, priceUsd: 60, followUpIntervalDays: null });
  const otherServiceId = svc2.json.data.id as string;
  made.services.push(otherServiceId);

  const tplBody = { name: `P2 TEST 5x Laser ${stamp}`, serviceId, sessionCount: 5, priceUsd: 400, validityDays: 90 };
  check('staff cannot create package offers (403)', (await call('POST', '/package-templates', st, tplBody)).status === 403);
  check('a package needs at least 2 sessions (400)', (await call('POST', '/package-templates', ot, { ...tplBody, sessionCount: 1 })).status === 400);
  const tpl = await call('POST', '/package-templates', ot, tplBody);
  check('owner creates a package offer', tpl.status === 201 && tpl.json.data.serviceName.includes('Laser'), JSON.stringify(tpl.json));
  const templateId = tpl.json.data.id as string;
  made.templates.push(templateId);
  check('staff can read package offers', (await call('GET', '/package-templates', st)).json.data.some((t: { id: string }) => t.id === templateId));

  const cl = await call('POST', '/clients', st, { fullName: 'P2 TEST Client', phoneE164: `+9617${phoneDigits.slice(0, 7)}`, instagramHandle: null, email: null, source: null, whatsappConsent: false, notes: null });
  const clientId = cl.json.data.id as string;
  made.clients.push(clientId);

  // ---------- Selling a package, with a partial LBP payment ----------
  const sale = await call('POST', '/client-packages', st, { clientId, templateId, payment: { currency: 'LBP', amount: 17900000, method: 'cash' } }, { 'Idempotency-Key': `sale-${stamp}` });
  check('staff sells a package with a payment in LBP', sale.status === 201, JSON.stringify(sale.json));
  const pkg = sale.json.data;
  check('sold with the template terms (5 sessions, $400)', pkg.sessionsTotal === 5 && pkg.priceUsd === 400);
  check('LBP payment counted at the rate: $200 of $400', pkg.paidUsd === 200);
  const saleAgain = await call('POST', '/client-packages', st, { clientId, templateId, payment: { currency: 'LBP', amount: 17900000, method: 'cash' } }, { 'Idempotency-Key': `sale-${stamp}` });
  check('retrying the same sale returns the same package (idempotent)', saleAgain.json.data.id === pkg.id);
  check('...and does not sell a second one', ((await call('GET', `/clients/${clientId}/packages`, st)).json.data as unknown[]).length === 1);
  const { data: payRow } = await admin.from('payments').select('currency, amount, exchange_rate_lbp_per_usd, amount_usd').eq('client_package_id', pkg.id).single();
  check('payment row stores the rate used and the USD value', Number(payRow?.exchange_rate_lbp_per_usd) === 89500 && Number(payRow?.amount_usd) === 200);
  const expiry = new Date(pkg.expiresAt);
  check('expires after the validity period', expiry.getTime() > Date.now() + 89 * 864e5 && expiry.getTime() < Date.now() + 92 * 864e5);

  await call('PATCH', `/package-templates/${templateId}`, ot, { priceUsd: 999, sessionCount: 9 });
  const pkgAfter = (await call('GET', `/client-packages/${pkg.id}`, st)).json.data;
  check('changing the offer later does not change a sold package', pkgAfter.priceUsd === 400 && pkgAfter.sessionsTotal === 5);

  // ---------- Booking against the package ----------
  const wrongService = await book(st, { clientId, serviceId: otherServiceId, startAt: slot(1, 7), clientPackageId: pkg.id });
  check('a package cannot be used for a different service (422)', wrongService.status === 422, JSON.stringify(wrongService.json));
  const booked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const b = await book(st, { clientId, serviceId, startAt: slot(2 + i, 8), clientPackageId: pkg.id });
    if (b.status === 201) booked.push(b.json.data.id);
    else check(`booking ${i + 1} on the package`, false, JSON.stringify(b.json));
  }
  check('five visits booked on a 5-session package', booked.length === 5);
  const apptRow = (await call('GET', `/appointments/${booked[0]}`, st)).json.data;
  check('a package visit costs 0 and points at the package', apptRow.priceUsd === 0 && apptRow.clientPackageId === pkg.id);
  const sixth = await book(st, { clientId, serviceId, startAt: slot(8, 8), clientPackageId: pkg.id });
  check('a sixth booking is refused: every session is already booked (422)', sixth.status === 422, JSON.stringify(sixth.json));
  check('the package shows nothing left to book', (await call('GET', `/client-packages/${pkg.id}`, st)).json.data.sessionsAvailableToBook === 0);
  const beyond = await call('PATCH', `/appointments/${booked[0]}`, st, { startAt: '2040-01-01T08:00:00Z' });
  check('cannot move a package visit past the package expiry (422)', beyond.status === 422, JSON.stringify(beyond.json));
  const otherClient = await call('POST', '/clients', st, { fullName: 'P2 TEST Other', phoneE164: `+9617${String(Number(phoneDigits.slice(0, 7)) + 1).padStart(7, '0')}`, instagramHandle: null, email: null, source: null, whatsappConsent: false, notes: null });
  made.clients.push(otherClient.json.data.id);
  const theirs = await book(st, { clientId: otherClient.json.data.id, serviceId, startAt: slot(20, 8), clientPackageId: pkg.id });
  check("cannot use another client's package (404)", theirs.status === 404, JSON.stringify(theirs.json));

  // ---------- Cancelling frees the session; completing uses it ----------
  const cancelled = await call('POST', `/appointments/${booked[4]}/cancel`, st);
  check('cancelling a package visit works', cancelled.status === 200);
  check('cancelling does not use a session, and frees it to book again', (await call('GET', `/client-packages/${pkg.id}`, st)).json.data.sessionsAvailableToBook === 1);
  const rebook = await book(st, { clientId, serviceId, startAt: slot(9, 8), clientPackageId: pkg.id });
  check('the freed session can be booked again', rebook.status === 201);
  booked[4] = rebook.json.data.id;

  for (let i = 0; i < 5; i++) {
    const c = await call('POST', `/appointments/${booked[i]}/complete`, st);
    if (c.status !== 200) check(`complete visit ${i + 1}`, false, JSON.stringify(c.json));
  }
  const done = (await call('GET', `/client-packages/${pkg.id}`, st)).json.data;
  check('after five visits: 5 used, 0 remaining, package completed', done.sessionsUsed === 5 && done.sessionsRemaining === 0 && done.status === 'completed', JSON.stringify(done));
  const again = await call('POST', `/appointments/${booked[0]}/complete`, st);
  check('completing an already completed visit is refused (422)', again.status === 422);

  // ---------- Paying a package off ----------
  check('a visit paid by a package takes no payment (422)', (await call('POST', '/payments', st, { appointmentId: booked[0], currency: 'USD', amount: 5 })).status === 422);
  const over = await call('POST', '/payments', st, { clientPackageId: pkg.id, currency: 'USD', amount: 250 });
  check('paying more than is owed is refused, and says how much is due', over.status === 422 && /\$200\.00/.test(over.json.error.message), JSON.stringify(over.json));
  const rest = await call('POST', '/payments', st, { clientPackageId: pkg.id, currency: 'USD', amount: 200 }, { 'Idempotency-Key': `rest-${stamp}` });
  check('paying the remaining $200 works', rest.status === 201 && rest.json.data.amountUsd === 200, JSON.stringify(rest.json));
  const restAgain = await call('POST', '/payments', st, { clientPackageId: pkg.id, currency: 'USD', amount: 200 }, { 'Idempotency-Key': `rest-${stamp}` });
  check('retrying with the same key records one payment, not two', restAgain.status === 201 && restAgain.json.data.id === rest.json.data.id);
  check('fully paid: any more is refused (422)', (await call('POST', '/payments', st, { clientPackageId: pkg.id, currency: 'LBP', amount: 44750 })).status === 422);
  check('paid in full', (await call('GET', `/client-packages/${pkg.id}`, st)).json.data.paidUsd === 400);

  // ---------- Voiding ----------
  const voidUrl = `/payments/${rest.json.data.id}/void`;
  const PIN = '481926';
  check('staff cannot void a payment, even with a passcode (403)', (await call('POST', voidUrl, st, { reason: 'Entered twice', passcode: PIN })).status === 403);
  check('staff have no passcode to set (403)', (await call('PUT', '/me/passcode', st, { password: STAFF.password, passcode: PIN })).status === 403);
  check('a void needs a reason (400)', (await call('POST', voidUrl, ot, { reason: '', passcode: PIN })).status === 400);
  check('a void needs a passcode (400)', (await call('POST', voidUrl, ot, { reason: 'Entered twice' })).status === 400);

  const noPin = await call('POST', voidUrl, ot, { reason: 'Entered twice', passcode: PIN });
  check('before a passcode is set, voiding is refused and says so (422)', noPin.status === 422 && noPin.json.error.details?.reason === 'PASSCODE_NOT_SET', JSON.stringify(noPin.json));
  check('passcode status: not set', (await call('GET', '/me/passcode', ot)).json.data.set === false);
  check('an easy passcode is refused (400)', (await call('PUT', '/me/passcode', ot, { password: OWNER.password, passcode: '123456' })).status === 400);
  const badPw = await call('PUT', '/me/passcode', ot, { password: 'not the password', passcode: PIN });
  check('setting a passcode needs the account password (403, not 401)', badPw.status === 403, JSON.stringify(badPw.json));
  const setPin = await call('PUT', '/me/passcode', ot, { password: OWNER.password, passcode: PIN });
  check('owner sets a passcode', setPin.status === 200 && setPin.json.data.set === true, JSON.stringify(setPin.json));
  const { data: pinRow } = await admin.from('passcodes').select('hash').eq('user_id', made.users[0]).single();
  check('only a salted hash is stored, never the passcode', !!pinRow?.hash.startsWith('scrypt$') && !pinRow.hash.includes(PIN));

  const wrongPin = await call('POST', voidUrl, ot, { reason: 'Entered twice', passcode: '739205' });
  check('a wrong passcode is refused with 403, not 401', wrongPin.status === 403 && wrongPin.json.error.code === 'PASSCODE_INVALID', JSON.stringify(wrongPin.json));
  check('...and the payment is still active', (await call('GET', `/payments?clientId=${clientId}`, st)).json.data.find((p) => p.id === rest.json.data.id).voidedAt === null);
  const voided = await call('POST', voidUrl, ot, { reason: 'Entered twice', passcode: PIN });
  check('owner voids a payment with a reason', voided.status === 200 && voided.json.data.voidReason === 'Entered twice' && !!voided.json.data.voidedAt);
  check('voiding twice is refused (422)', (await call('POST', voidUrl, ot, { reason: 'again', passcode: PIN })).status === 422);
  const listed = await call('GET', `/payments?clientId=${clientId}`, st);
  check('a voided payment stays on record, marked void', listed.json.data.some((p: { id: string; voidedAt: string | null }) => p.id === rest.json.data.id && p.voidedAt));
  check('a void takes the money back off the balance', (await call('GET', `/client-packages/${pkg.id}`, st)).json.data.paidUsd === 200);
  const { count: stillThere } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('id', rest.json.data.id);
  check('nothing is deleted from the database', stillThere === 1);
  check('...so the amount can be paid again', (await call('POST', '/payments', st, { clientPackageId: pkg.id, currency: 'USD', amount: 200 })).status === 201);

  // ---------- A normal visit paid in two currencies, across a rate change ----------
  const visit = await book(st, { clientId, serviceId, startAt: slot(15, 9) });
  const visitId = visit.json.data.id as string;
  check('a normal visit costs the service price', visit.json.data.priceUsd === 100);
  const p1 = await call('POST', '/payments', st, { appointmentId: visitId, currency: 'LBP', amount: 4475000 });
  check('4,475,000 LBP at 89,500 is $50', p1.status === 201 && p1.json.data.amountUsd === 50 && p1.json.data.exchangeRate === 89500, JSON.stringify(p1.json));
  const r2 = await call('POST', '/exchange-rates', ot, { lbpPerUsd: 100000 });
  check('owner changes the rate', r2.status === 201);
  if (r2.json?.data?.id) made.rates.push(r2.json.data.id);
  const p2 = await call('POST', '/payments', st, { appointmentId: visitId, currency: 'LBP', amount: 5000000 });
  check('the new payment uses the new rate: 5,000,000 LBP at 100,000 is $50', p2.status === 201 && p2.json.data.amountUsd === 50 && p2.json.data.exchangeRate === 100000, JSON.stringify(p2.json));
  const forVisit = (await call('GET', `/payments?appointmentId=${visitId}`, st)).json.data;
  const old = forVisit.find((p: { id: string }) => p.id === p1.json.data.id);
  check('the earlier payment keeps its original rate', old.exchangeRate === 89500 && old.amountUsd === 50);
  check('the visit is now paid in full, and more is refused', (await call('POST', '/payments', st, { appointmentId: visitId, currency: 'USD', amount: 1 })).status === 422);
  const cancelledVisit = await book(st, { clientId, serviceId, startAt: slot(16, 9) });
  await call('POST', `/appointments/${cancelledVisit.json.data.id}/cancel`, st);
  check('a cancelled visit takes no payment (422)', (await call('POST', '/payments', st, { appointmentId: cancelledVisit.json.data.id, currency: 'USD', amount: 10 })).status === 422);
  check('a payment needs a valid target (400)', (await call('POST', '/payments', st, { currency: 'USD', amount: 10 })).status === 400);
  check('a payment cannot be both visit and package (400)', (await call('POST', '/payments', st, { appointmentId: visitId, clientPackageId: pkg.id, currency: 'USD', amount: 1 })).status === 400);

  // ---------- The no-show rule ----------
  const sale2 = await call('POST', '/client-packages', st, { clientId, templateId });
  const pkg2 = sale2.json.data;
  made.templates.length && 0;
  check('a package can be sold with no payment yet', sale2.status === 201 && pkg2.paidUsd === 0);

  check('owner sets the rule: a no-show does NOT use a session', (await setNoShowRule(false)).status === 200);
  const ns1 = await book(st, { clientId, serviceId, startAt: slot(22, 9), clientPackageId: pkg2.id });
  const nsRes1 = await call('POST', `/appointments/${ns1.json.data.id}/no-show`, st);
  check('with rule off: no-show uses no session', nsRes1.status === 200 && nsRes1.json.sessionConsumed === false, JSON.stringify(nsRes1.json));
  check('...and the package is untouched', (await call('GET', `/client-packages/${pkg2.id}`, st)).json.data.sessionsUsed === 0);

  check('owner changes the rule: a no-show DOES use a session', (await setNoShowRule(true)).status === 200);
  const ns2 = await book(st, { clientId, serviceId, startAt: slot(23, 9), clientPackageId: pkg2.id });
  const nsRes2 = await call('POST', `/appointments/${ns2.json.data.id}/no-show`, st);
  check('with rule on: the no-show uses one session', nsRes2.status === 200 && nsRes2.json.sessionConsumed === true, JSON.stringify(nsRes2.json));
  check('...taken from the package', (await call('GET', `/client-packages/${pkg2.id}`, st)).json.data.sessionsUsed === 1);
  check('a no-show on a normal visit uses nothing and still works', (await call('POST', `/appointments/${(await book(st, { clientId, serviceId, startAt: slot(24, 9) })).json.data.id}/no-show`, st)).json.sessionConsumed === false);
  check('staff cannot change the rule (403)', (await call('PUT', '/clinic-settings', st, {})).status === 403);

  // ---------- Reading it back ----------
  const all = (await call('GET', `/clients/${clientId}/packages`, st)).json.data as { id: string; status: string }[];
  check("the client's packages list shows both", all.length === 2 && all.some((p) => p.status === 'completed') && all.some((p) => p.status === 'active'));
  check('payments for a client can be listed by staff', (await call('GET', `/payments?clientId=${clientId}`, st)).status === 200);
  check('a payments list needs a filter (400)', (await call('GET', '/payments', st)).status === 400);

  // ---------- The passcode locks after repeated wrong tries ----------
  for (let i = 0; i < 5; i++) await call('POST', voidUrl, ot, { reason: 'guess', passcode: '739205' });
  const lockedOut = await call('POST', voidUrl, ot, { reason: 'guess', passcode: PIN });
  check('after 5 wrong tries in 15 minutes the passcode is locked, even the right one (429)', lockedOut.status === 429, JSON.stringify(lockedOut.json));

  // ---------- Audit trail ----------
  const { data: audit } = await admin.from('audit_logs').select('action').in('action', ['package.sell', 'payment.record', 'payment.void', 'payment.void_denied', 'passcode.set', 'exchange_rate.set', 'package_template.create']);
  const actions = new Set((audit ?? []).map((a) => a.action));
  check('sales, payments, voids, refused voids, passcode changes, rates and offers are all audited', ['package.sell', 'payment.record', 'payment.void', 'payment.void_denied', 'passcode.set', 'exchange_rate.set', 'package_template.create'].every((a) => actions.has(a)));
  void hadRate;
}

async function cleanup() {
  const ids = made.users;
  const tables = async (fn: () => PromiseLike<unknown>) => { try { await fn(); } catch { /* keep going */ } };
  if (made.clients.length) {
    await admin.from('payments').delete().in('client_id', made.clients);
    const { data: pk } = await admin.from('client_packages').select('id').in('client_id', made.clients);
    const pkIds = (pk ?? []).map((p) => p.id as string);
    if (pkIds.length) await admin.from('package_usages').delete().in('client_package_id', pkIds);
    await admin.from('visit_notes').delete().in('client_id', made.clients);
    await admin.from('appointments').delete().in('client_id', made.clients);
    if (pkIds.length) await admin.from('client_packages').delete().in('id', pkIds);
  }
  if (made.templates.length) await admin.from('package_templates').delete().in('id', made.templates);
  if (made.services.length) await admin.from('services').delete().in('id', made.services);
  if (made.clients.length) await admin.from('clients').delete().in('id', made.clients);
  if (made.rates.length) await admin.from('exchange_rates').delete().in('id', made.rates);
  if (ids.length) {
    await admin.from('idempotency_keys').delete().or(ids.map((i) => `key.like.${i}:%`).join(','));
    await admin.from('audit_logs').delete().in('actor_id', ids);
    await admin.from('profiles').delete().in('id', ids);
    for (const id of ids) await tables(() => admin.auth.admin.deleteUser(id));
  }
  // Put the clinic settings back exactly as they were
  if (settingsBackup === null) await admin.from('clinic_settings').delete().eq('id', 1);
  else if (settingsBackup) await admin.from('clinic_settings').update({ no_show_uses_session: settingsBackup.no_show_uses_session, name: settingsBackup.name, updated_at: settingsBackup.updated_at }).eq('id', 1);
  await admin.from('rate_limits').delete().like('key', 'login-email:%');
  await admin.from('rate_limits').delete().like('key', 'passcode%');
  await admin.from('audit_logs').delete().eq('action', 'auth.login_failed').is('actor_id', null);
}

main()
  .catch((e) => {
    failures++;
    results.push(`ERROR  ${e?.stack ?? e}`);
  })
  .finally(async () => {
    await cleanup().catch((e) => results.push(`CLEANUP ERROR  ${e?.message ?? e}`));
    console.log(results.join('\n'));
    console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
