import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { AppError } from './errors.js';
import { checkLimit, defaultStore, keyOf } from './rate-limit.js';
import { getPasscode } from '../repositories/passcodes.js';

const scryptAsync = (secret: Buffer, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(secret, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

// A six-digit passcode has only a million possibilities, so the database hash alone would be
// guessed in seconds. Mixing in a secret that never enters the database (the pepper) means a
// stolen copy of the database is not enough. The slow hash and the attempt limit cover the rest.
const withPepper = (code: string, pepper: string) => createHmac('sha256', pepper).update(code).digest();

/** Returns `scrypt$N$r$p$salt$key`. The parameters travel with the hash so they can change later. */
export async function hashPasscode(code: string, pepper: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(withPepper(code, pepper), salt, KEY_LENGTH, {
    N, r: R, p: P, maxmem: 256 * N * R,
  });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Constant-time check. A stored value that cannot be read never matches. */
export async function checkPasscodeHash(code: string, stored: string, pepper: string): Promise<boolean> {
  const [kind, n, r, p, saltB64, keyB64] = stored.split('$');
  if (kind !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  try {
    const actual = await scryptAsync(withPepper(code, pepper), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * Number(n) * Number(r),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function getPepper(): string {
  const pepper = getEnv().PASSCODE_PEPPER;
  if (!pepper) {
    // Say what is wrong, instead of a blank "something went wrong". The detail is only
    // about server setup, so it is safe to show.
    throw new AppError(
      503,
      'INTERNAL',
      'Passcodes are not set up on the server yet. Add PASSCODE_PEPPER to the API settings and restart the API.',
    );
  }
  return pepper;
}

export const MAX_PASSCODE_ATTEMPTS = 5;
export const PASSCODE_LOCK_SECONDS = 900;

/**
 * Confirms the signed-in person's own passcode before a sensitive action. Every attempt counts:
 * five in 15 minutes locks the passcode until the window passes, and a correct entry clears the
 * count. A wrong passcode is a 403 so the web app does not mistake it for an ended session.
 */
export async function assertPasscode(userId: string, passcode: string): Promise<void> {
  const stored = await getPasscode(userId);
  if (!stored) {
    throw AppError.businessRule('You have not set a passcode yet. Set one under My passcode.', {
      reason: 'PASSCODE_NOT_SET',
    });
  }
  await checkLimit({
    name: 'passcode',
    value: userId,
    limit: MAX_PASSCODE_ATTEMPTS,
    windowSeconds: PASSCODE_LOCK_SECONDS,
  });
  if (!(await checkPasscodeHash(passcode, stored.hash, getPepper()))) throw AppError.invalidPasscode();
  await defaultStore().reset(keyOf('passcode', userId));
}
