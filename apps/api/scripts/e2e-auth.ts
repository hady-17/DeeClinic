// Throwaway end-to-end check of auth and user management against the real project.
// Creates its own test accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';

const API = process.env.API ?? 'http://localhost:4000/api/v1';
const URL_ = process.env.SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now().toString(36);
const OWNER = { email: `authtest-owner-${stamp}@example.com`, password: 'correct horse battery staple' };
const STAFF = { email: `authtest-staff-${stamp}@example.com`, password: 'purple giraffe lamp 42' };
const INVITED = { email: `authtest-invited-${stamp}@example.com` };

let failures = 0;
const results: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   <-- ${extra}`}`);
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}

const login = async (c: { email: string; password: string }) => {
  const r = await call('POST', '/auth/login', undefined, c);
  return { ...r, token: r.json?.data?.session?.accessToken as string | undefined };
};

const created: string[] = [];

async function main() {
  // The throwaway owner (a second owner, so the real owner is never at risk)
  const { data: o, error: oe } = await admin.auth.admin.createUser({ ...OWNER, email_confirm: true });
  if (oe) throw oe;
  created.push(o.user.id);
  const { error: pe } = await admin.from('profiles').insert({ id: o.user.id, full_name: 'Auth Test Owner', role: 'owner', email: OWNER.email });
  if (pe) throw pe;

  const ownerLogin = await login(OWNER);
  check('owner can log in through the API', ownerLogin.status === 200 && !!ownerLogin.token, JSON.stringify(ownerLogin.json));
  const ot = ownerLogin.token!;

  const wrong = await login({ email: OWNER.email, password: 'definitely wrong 123' });
  check('wrong password -> 401, no details leaked', wrong.status === 401 && wrong.json.error.message === 'Incorrect email or password.');

  const me = await call('GET', '/me', ot);
  check('/me returns role and permissions', me.status === 200 && me.json.data.role === 'owner' && me.json.data.permissions.includes('users.manage'));

  // Create staff with a password
  const mk = await call('POST', '/users', ot, { email: STAFF.email, fullName: 'Auth Test Staff', role: 'staff', password: STAFF.password });
  check('owner creates a staff user with a password', mk.status === 201 && mk.json.data.role === 'staff', JSON.stringify(mk.json));
  const staffId = mk.json?.data?.id as string;
  if (staffId) created.push(staffId);

  const weakPw = await call('POST', '/users', ot, { email: `x-${stamp}@example.com`, fullName: 'W', role: 'staff', password: 'password123' });
  check('weak password rejected on create', weakPw.status === 400, JSON.stringify(weakPw.json));
  const emailPw = await call('POST', '/users', ot, { email: `maria.santos${stamp}@example.com`, fullName: 'W', role: 'staff', password: 'maria.santos-2026!' });
  check('password containing the email name rejected', emailPw.status === 400, JSON.stringify(emailPw.json));
  const dup = await call('POST', '/users', ot, { email: STAFF.email, fullName: 'Dup', role: 'staff', password: 'another long passphrase' });
  check('duplicate email -> 409', dup.status === 409, JSON.stringify(dup.json));

  // The profile is linked to the login
  const { data: prof } = await admin.from('profiles').select('id, role, email, is_active').eq('id', staffId).maybeSingle();
  check('profile row linked to the auth user', prof?.id === staffId && prof?.email === STAFF.email && prof?.is_active === true);

  // Staff permissions
  const sl = await login(STAFF);
  check('staff can log in', sl.status === 200 && !!sl.token, JSON.stringify(sl.json));
  const st = sl.token!;
  check('staff can read clients', (await call('GET', '/clients', st)).status === 200);
  check('staff cannot list users (403)', (await call('GET', '/users', st)).status === 403);
  check('staff cannot create users (403)', (await call('POST', '/users', st, { email: `y-${stamp}@example.com`, fullName: 'Y', role: 'staff', password: 'some long passphrase 1' })).status === 403);
  check('staff cannot change clinic settings (403)', (await call('PUT', '/clinic-settings', st, {})).status === 403);
  check('staff cannot import clients (403)', (await call('POST', '/clients/import/preview', st, { csv: 'name,phone\nA,1' })).status === 403);
  check('staff cannot add services (403)', (await call('POST', '/services', st, {})).status === 403);

  // Role change
  const promote = await call('PATCH', `/users/${staffId}`, ot, { role: 'manager' });
  check('owner changes staff to manager', promote.status === 200 && promote.json.data.role === 'manager', JSON.stringify(promote.json));
  const sl2 = await login(STAFF);
  check('manager can import (permission follows the role)', (await call('POST', '/clients/import/preview', sl2.token, { csv: 'name,phone\nA,1' })).status !== 403);
  check('owner cannot change their own role (422)', (await call('PATCH', `/users/${o.user.id}`, ot, { role: 'staff' })).status === 422);

  // Deactivation takes effect immediately
  check('owner cannot deactivate themself (422)', (await call('POST', `/users/${o.user.id}/deactivate`, ot)).status === 422);
  check('owner cannot delete themself (422)', (await call('DELETE', `/users/${o.user.id}`, ot)).status === 422);
  const off = await call('POST', `/users/${staffId}/deactivate`, ot);
  check('owner deactivates a user', off.status === 200 && off.json.data.isActive === false, JSON.stringify(off.json));
  const stale = await call('GET', '/clients', sl2.token);
  check('their existing token stops working at once (ACCOUNT_DISABLED)', stale.status === 403 && stale.json.error.code === 'ACCOUNT_DISABLED', JSON.stringify(stale.json));
  const blocked = await login(STAFF);
  check('deactivated user cannot log in again', blocked.status >= 400 && !blocked.token, JSON.stringify(blocked.json));
  const { data: ban } = await admin.auth.admin.getUserById(staffId);
  check('login is banned in Supabase Auth', !!ban.user?.banned_until);

  const on = await call('POST', `/users/${staffId}/reactivate`, ot);
  check('owner reactivates the user', on.status === 200 && on.json.data.isActive === true, JSON.stringify(on.json));
  check('reactivated user can log in', (await login(STAFF)).status === 200);

  // Delete rules: used account is protected, fresh account can go
  const del = await call('DELETE', `/users/${staffId}`, ot);
  check('user with recorded activity cannot be deleted (409)', del.status === 409, JSON.stringify(del.json));
  const inv = await call('POST', '/users', ot, { email: INVITED.email, fullName: 'Never Logged In', role: 'staff', password: 'quiet purple mountain 7' });
  const invId = inv.json?.data?.id as string;
  if (invId) created.push(invId);
  const delFresh = await call('DELETE', `/users/${invId}`, ot);
  check('a fresh account can be deleted', delFresh.status === 204, JSON.stringify(delFresh.json));
  const { data: gone } = await admin.auth.admin.getUserById(invId);
  check('...and its login is gone too', !gone.user);

  // List
  const list = await call('GET', '/users', ot);
  check('owner lists users with last sign-in', list.status === 200 && list.json.data.some((u: { id: string; lastSignInAt: string | null }) => u.id === staffId && u.lastSignInAt));

  // Password reset: forgot-password never reveals whether an email exists
  const fUnknown = await call('POST', '/auth/forgot-password', undefined, { email: `nobody-${stamp}@example.com` });
  check('forgot-password answers 200 for an unknown email', fUnknown.status === 200 && fUnknown.json.data.ok === true);

  // set-password: a password-login token must be refused; an emailed-link token must work
  const viaPassword = await call('POST', '/auth/set-password', ot, { password: 'a brand new passphrase 1' });
  check('set-password refuses a normal login session (403)', viaPassword.status === 403, JSON.stringify(viaPassword.json));

  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'recovery', email: OWNER.email });
  if (le) throw le;
  const { data: verified, error: ve } = await anon().auth.verifyOtp({ type: 'recovery', token_hash: link.properties.hashed_token });
  if (ve || !verified.session) throw ve ?? new Error('no session from recovery link');
  const rt = verified.session.access_token;
  const tooWeak = await call('POST', '/auth/set-password', rt, { password: 'password123' });
  check('set-password enforces the password policy (400)', tooWeak.status === 400, JSON.stringify(tooWeak.json));
  const newPw = 'a brand new passphrase 1';
  const setOk = await call('POST', '/auth/set-password', rt, { password: newPw });
  check('set-password works from a recovery link', setOk.status === 200, JSON.stringify(setOk.json));
  check('old password no longer works', (await login(OWNER)).status === 401);
  check('new password works', (await login({ email: OWNER.email, password: newPw })).status === 200);
  check('every older session was revoked', (await call('GET', '/me', ot)).status === 401);
  const reuse = await call('POST', '/auth/set-password', rt, { password: 'yet another passphrase 2' });
  check('the link session cannot be reused', reuse.status === 401, JSON.stringify(reuse.json));

  // Lockout: 5 failures then blocked, and a success would have reset it
  for (let i = 0; i < 5; i++) await login({ email: STAFF.email, password: `wrong-${i}-passphrase` });
  const locked = await login(STAFF);
  check('6th attempt on one account is rate limited (429 + Retry-After)', locked.status === 429 && !!locked.headers.get('retry-after'), `${locked.status}`);
}

async function cleanup() {
  const ids = created.filter(Boolean);
  if (ids.length) {
    await admin.from('audit_logs').delete().in('actor_id', ids);
    await admin.from('audit_logs').delete().in('entity_id', ids);
    await admin.from('profiles').delete().in('id', ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
  // The throwaway test emails also left rate-limit counters and anonymous audit rows
  await admin.from('rate_limits').delete().like('key', 'login-email:%');
  await admin.from('audit_logs').delete().eq('action', 'auth.login_failed').is('actor_id', null);
}

main()
  .catch((e) => {
    failures++;
    results.push(`ERROR  ${e?.message ?? e}`);
  })
  .finally(async () => {
    await cleanup().catch((e) => results.push(`CLEANUP ERROR  ${e?.message ?? e}`));
    console.log(results.join('\n'));
    console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
