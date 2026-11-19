import {
  passwordContainsEmail,
  userCreateSchema,
  userUpdateSchema,
  type Role,
  type UserSummary,
} from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getEnv } from '../config/env.js';
import { primaryOrigin } from '../config/origins.js';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { rateLimit } from '../lib/rate-limit.js';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

export const usersRouter = Router();

const idSchema = z.uuid();
const COLUMNS = 'id, email, full_name, role, is_active, deactivated_at, created_at';
const BAN_FOREVER = '876000h'; // about 100 years

usersRouter.use(
  '/users',
  requireAuth,
  requirePermission('users.manage'),
  rateLimit({ name: 'users', limit: 30, windowSeconds: 60, key: (req) => req.user!.id, failOpen: true }),
);

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
}

const toSummary = (r: ProfileRow, lastSignInAt: string | null): UserSummary => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  role: r.role,
  isActive: r.is_active,
  deactivatedAt: r.deactivated_at,
  createdAt: r.created_at,
  lastSignInAt,
});

/** Database rules (last owner, rows still referenced) become readable 409s. */
function mapDbError(err: unknown): never {
  const e = err as { message?: string; code?: string };
  if (e.message?.includes('LAST_OWNER')) {
    throw AppError.conflict('CONFLICT', 'The clinic must keep at least one active owner.');
  }
  if (e.code === '23503') {
    throw AppError.conflict(
      'CONFLICT',
      'This user has recorded activity and cannot be deleted. Deactivate the account instead.',
    );
  }
  throw err;
}

async function getProfile(id: string): Promise<ProfileRow> {
  const { data, error } = await getSupabase().from('profiles').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw AppError.notFound('User not found.');
  return data as ProfileRow;
}

const notSelf = (id: string, callerId: string, what: string) => {
  if (id === callerId) throw AppError.businessRule(`You cannot ${what} your own account.`);
};

usersRouter.get('/users', async (_req, res) => {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase.from('profiles').select(COLUMNS).order('created_at');
  if (error) throw error;
  const { data: authList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const lastSignIn = new Map(authList.users.map((u) => [u.id, u.last_sign_in_at ?? null]));
  res.json({ data: (rows as ProfileRow[]).map((r) => toSummary(r, lastSignIn.get(r.id) ?? null)) });
});

usersRouter.post('/users', async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  if (input.password && passwordContainsEmail(input.password, input.email)) {
    const message = 'The password must not contain the email name.';
    throw AppError.validation(message, { issues: [{ path: 'password', message }] });
  }

  const admin = getSupabase().auth.admin;
  // With a password the account is ready to use. Without one, an invite email lets the
  // person choose their own password.
  const { data, error } = input.password
    ? await admin.createUser({ email: input.email, password: input.password, email_confirm: true })
    : await admin.inviteUserByEmail(input.email, { redirectTo: `${primaryOrigin(getEnv().WEB_ORIGIN)}/reset-password` });

  if (error || !data.user) {
    if (error && (error.status === 422 || /already|registered|exists/i.test(error.message))) {
      throw AppError.conflict('CONFLICT', 'A user with this email already exists.', { field: 'email' });
    }
    throw error ?? new Error('User was not created');
  }

  // Link the login to a profile. If that fails, remove the login so nothing is left half-made.
  const { error: profileError } = await getSupabase().from('profiles').insert({
    id: data.user.id,
    full_name: input.fullName,
    role: input.role,
    email: input.email,
  });
  if (profileError) {
    await admin.deleteUser(data.user.id).catch((err) => logger.error({ err }, 'Could not undo user creation'));
    throw profileError;
  }

  const created = toSummary(await getProfile(data.user.id), null);
  await writeAudit({
    actorId: req.user!.id,
    action: 'user.create',
    entity: 'profiles',
    entityId: created.id,
    after: { id: created.id, email: created.email, role: created.role, invited: !input.password },
  });
  res.status(201).json({ data: created });
});

usersRouter.patch('/users/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = userUpdateSchema.parse(req.body);
  if (patch.role !== undefined) notSelf(id, req.user!.id, 'change the role of');

  const before = await getProfile(id);
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      ...(patch.fullName !== undefined && { full_name: patch.fullName }),
      ...(patch.role !== undefined && { role: patch.role }),
    })
    .eq('id', id);
  if (error) mapDbError(error);

  const after = await getProfile(id);
  await writeAudit({
    actorId: req.user!.id,
    action: 'user.update',
    entity: 'profiles',
    entityId: id,
    before: { role: before.role, fullName: before.full_name },
    after: { role: after.role, fullName: after.full_name },
  });
  res.json({ data: toSummary(after, null) });
});

/**
 * Deactivating blocks the account at once. The profile flag is checked on every request,
 * so the person is locked out even if their token has not expired. The login is also
 * banned, so they cannot start a new session or refresh an old one.
 */
usersRouter.post('/users/:id/deactivate', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  notSelf(id, req.user!.id, 'deactivate');
  await getProfile(id);

  const { error } = await getSupabase()
    .from('profiles')
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) mapDbError(error);

  const { error: banError } = await getSupabase().auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER });
  if (banError) throw banError;

  await writeAudit({ actorId: req.user!.id, action: 'user.deactivate', entity: 'profiles', entityId: id });
  res.json({ data: toSummary(await getProfile(id), null) });
});

usersRouter.post('/users/:id/reactivate', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await getProfile(id);

  const { error: banError } = await getSupabase().auth.admin.updateUserById(id, { ban_duration: 'none' });
  if (banError) throw banError;
  const { error } = await getSupabase()
    .from('profiles')
    .update({ is_active: true, deactivated_at: null })
    .eq('id', id);
  if (error) throw error;

  await writeAudit({ actorId: req.user!.id, action: 'user.reactivate', entity: 'profiles', entityId: id });
  res.json({ data: toSummary(await getProfile(id), null) });
});

/**
 * Permanent removal. Only possible for accounts with no recorded activity; anyone who
 * has booked, noted or recorded anything must be deactivated so the history stays intact.
 */
usersRouter.delete('/users/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  notSelf(id, req.user!.id, 'delete');
  const profile = await getProfile(id);

  const { error } = await getSupabase().from('profiles').delete().eq('id', id);
  if (error) mapDbError(error);
  const { error: authError } = await getSupabase().auth.admin.deleteUser(id);
  if (authError) throw authError;

  await writeAudit({
    actorId: req.user!.id,
    action: 'user.delete',
    entity: 'profiles',
    entityId: null,
    before: { id, email: profile.email, role: profile.role },
  });
  res.status(204).end();
});
