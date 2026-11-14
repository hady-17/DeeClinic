import { can, type Permission, type Role } from '@deeclinic/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { getSupabase } from '../lib/supabase.js';

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: Role;
  fullName: string;
  /** The raw access token, kept so the caller's own sessions can be revoked */
  token: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function bearerToken(header: string | undefined): string | undefined {
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || undefined : undefined;
}

/**
 * Verifies the Supabase token, then loads the caller's profile. A valid token is not
 * enough: the account must have a profile and be active. Deactivating a user takes
 * effect on their very next request, even if their token has not expired.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req.header('authorization'));
  if (!token) throw AppError.unauthorized();

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error?.code === 'user_banned' || /banned/i.test(error?.message ?? '')) {
    // Deactivated accounts are banned in Supabase, which rejects their token first
    throw AppError.accountDisabled();
  }
  if (error || !data.user) throw AppError.unauthorized('Session is invalid or expired.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw AppError.forbidden('No profile for this account.');
  if (!profile.is_active) throw AppError.accountDisabled();

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role as Role,
    fullName: profile.full_name as string,
    token,
  };
  next();
};

/** Gate for a single action. Use this on every route; never check roles directly. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !can(req.user.role, permission)) throw AppError.forbidden();
    next();
  };
