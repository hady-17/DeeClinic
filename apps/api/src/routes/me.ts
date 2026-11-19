import { permissionsFor, setPasscodeSchema, type Me, type PasscodeStatus } from '@deeclinic/shared';
import { Router } from 'express';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { getPepper, hashPasscode } from '../lib/passcode.js';
import { checkLimit } from '../lib/rate-limit.js';
import { createAuthClient } from '../lib/supabase.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getPasscode, savePasscode } from '../repositories/passcodes.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, (req, res) => {
  const { id, email, fullName, role } = req.user!;
  const me: Me = { id, email, fullName, role, permissions: permissionsFor(role) };
  res.json({ data: me });
});

// Only people who can approve a void have a passcode.
const canHavePasscode = requirePermission('payments.void');

meRouter.get('/me/passcode', requireAuth, canHavePasscode, async (req, res) => {
  const stored = await getPasscode(req.user!.id);
  const status: PasscodeStatus = { set: Boolean(stored), updatedAt: stored?.updatedAt ?? null };
  res.json({ data: status });
});

/**
 * Sets or changes the caller's passcode. An open session is not enough: the account password
 * is asked for again, so someone at an unlocked screen cannot quietly set their own passcode.
 */
meRouter.put('/me/passcode', requireAuth, canHavePasscode, async (req, res) => {
  const { password, passcode } = setPasscodeSchema.parse(req.body);
  const user = req.user!;
  if (!user.email) throw AppError.forbidden('This account has no email to confirm with.');

  // Guessing the password through this form is limited the same way as at login
  await checkLimit({ name: 'passcode-set', value: user.id, limit: 5, windowSeconds: 900 });
  const { error } = await createAuthClient().auth.signInWithPassword({ email: user.email, password });
  if (error) throw AppError.forbidden('Incorrect password.');

  await savePasscode(user.id, await hashPasscode(passcode, getPepper()));
  // Records that it changed, never the passcode itself
  await writeAudit({ actorId: user.id, action: 'passcode.set', entity: 'passcodes', entityId: user.id });
  res.json({ data: { set: true, updatedAt: new Date().toISOString() } satisfies PasscodeStatus });
});
