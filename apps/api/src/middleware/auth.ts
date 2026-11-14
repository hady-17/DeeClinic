import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { getSupabase } from '../lib/supabase.js';

export type Role = 'owner' | 'manager' | 'staff';

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: Role;
  fullName: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Verifies the Supabase bearer token and loads the caller's profile and role. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw AppError.unauthorized();

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw AppError.unauthorized('Session is invalid or expired.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw AppError.forbidden('No profile for this account.');

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role as Role,
    fullName: profile.full_name as string,
  };
  next();
};

/** Role gate. For the MVP only the owner exists; adding staff roles changes only this. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
