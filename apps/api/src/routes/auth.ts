import {
  forgotPasswordSchema,
  loginSchema,
  passwordContainsEmail,
  setPasswordSchema,
  type Role,
  type Session,
} from '@deeclinic/shared';
import { Router } from 'express';
import { getEnv } from '../config/env.js';
import { primaryOrigin } from '../config/origins.js';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { isPasswordOnlySession } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { checkLimit, defaultStore, keyOf, rateLimit } from '../lib/rate-limit.js';
import { createAuthClient, getSupabase } from '../lib/supabase.js';
import { bearerToken } from '../middleware/auth.js';

export const authRouter = Router();

/** Auth events must never break the request they describe. */
async function auditQuietly(entry: Parameters<typeof writeAudit>[0]) {
  try {
    await writeAudit(entry);
  } catch (err) {
    logger.error({ err, action: entry.action }, 'Could not write auth audit entry');
  }
}

const emailTag = (email: string) => keyOf('email', email).slice(-16);

/**
 * Login goes through the API so the account itself can be throttled (5 wrong
 * passwords in 15 minutes locks it for the rest of the window), failures are logged,
 * and deactivated accounts never get a session.
 */
authRouter.post(
  '/auth/login',
  rateLimit({ name: 'login-ip', limit: 30, windowSeconds: 900 }),
  async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    await checkLimit({ name: 'login-email', value: email, limit: 5, windowSeconds: 900 });

    const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
    if (error?.status === 429) throw AppError.tooManyRequests();
    if (error || !data.session || !data.user) {
      await auditQuietly({
        actorId: null,
        action: 'auth.login_failed',
        entity: 'auth',
        after: { emailTag: emailTag(email) },
      });
      throw AppError.unauthorized('Incorrect email or password.');
    }

    const supabase = getSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile || !profile.is_active) {
      // The password was right but this account may not use the app: end the session.
      await supabase.auth.admin.signOut(data.session.access_token, 'global').catch(() => undefined);
      await auditQuietly({
        actorId: profile ? data.user.id : null,
        action: 'auth.login_blocked',
        entity: 'auth',
        after: { reason: profile ? 'deactivated' : 'no_profile', emailTag: emailTag(email) },
      });
      throw profile ? AppError.accountDisabled() : AppError.forbidden('No profile for this account.');
    }

    await defaultStore().reset(keyOf('login-email', email));
    await auditQuietly({ actorId: data.user.id, action: 'auth.login', entity: 'auth' });

    const session: Session = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
    };
    res.json({
      data: {
        session,
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: profile.full_name as string,
          role: profile.role as Role,
        },
      },
    });
  },
);

/**
 * Always answers the same way, whether or not the email belongs to an account, so the
 * form cannot be used to find out who works at the clinic.
 */
authRouter.post(
  '/auth/forgot-password',
  rateLimit({ name: 'forgot-ip', limit: 10, windowSeconds: 3600 }),
  async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    await checkLimit({ name: 'forgot-email', value: email, limit: 3, windowSeconds: 3600 });

    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('id, is_active')
      .eq('email', email)
      .maybeSingle();

    if (profile?.is_active) {
      const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${primaryOrigin(getEnv().WEB_ORIGIN)}/reset-password`,
      });
      if (error) logger.error({ status: error.status }, 'Could not send the reset email');
      await auditQuietly({
        actorId: profile.id as string,
        action: 'auth.password_reset_requested',
        entity: 'auth',
      });
    }
    res.json({ data: { ok: true } });
  },
);

/**
 * Sets a new password from a reset or invite link. Only a session started by an emailed
 * link is accepted, so a stolen login session cannot be used to take over the account.
 * The password rules are enforced here, on the server.
 */
authRouter.post(
  '/auth/set-password',
  rateLimit({ name: 'setpw-ip', limit: 10, windowSeconds: 3600 }),
  async (req, res) => {
    const token = bearerToken(req.header('authorization'));
    if (!token) throw AppError.unauthorized('This link has expired. Request a new one.');
    const { password } = setPasswordSchema.parse(req.body);

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw AppError.unauthorized('This link has expired. Request a new one.');
    const user = data.user;

    if (isPasswordOnlySession(token)) {
      throw AppError.forbidden('Use the link from your reset email to set a new password.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) throw AppError.forbidden('No profile for this account.');
    if (!profile.is_active) throw AppError.accountDisabled();

    if (user.email && passwordContainsEmail(password, user.email)) {
      const message = 'The password must not contain your email name.';
      throw AppError.validation(message, { issues: [{ path: 'password', message }] });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updateError) throw updateError;
    // Sign out everywhere, including this link's session. They log in with the new password.
    await supabase.auth.admin.signOut(token, 'global').catch(() => undefined);
    await auditQuietly({ actorId: user.id, action: 'auth.password_set', entity: 'auth' });

    res.json({ data: { ok: true } });
  },
);
