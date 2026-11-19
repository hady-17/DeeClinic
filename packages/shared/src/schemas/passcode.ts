import { z } from 'zod';

export const PASSCODE_LENGTH = 6;

/** Passcodes that are too easy to guess, even though they are six digits. */
export function isWeakPasscode(code: string): boolean {
  if (/^(\d)\1+$/.test(code)) return true; // 000000, 111111, ...
  const digits = [...code].map(Number);
  const steps = digits.slice(1).map((d, i) => d - digits[i]!);
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return true; // 123456, 987654
  if (/^(\d\d)\1\1$/.test(code) || /^(\d\d\d)\1$/.test(code)) return true; // 121212, 123123
  return ['112233', '654321', '123321', '159753', '000001'].includes(code);
}

/** Used when choosing a passcode. */
export const newPasscodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Use exactly 6 digits')
  .refine((c) => !isWeakPasscode(c), 'That passcode is too easy to guess. Avoid repeats and sequences.');

/** Used when entering one. The format is checked but the weak-list is not applied. */
export const enteredPasscodeSchema = z.string().regex(/^\d{6}$/, 'Enter your 6-digit passcode');

/** Setting or changing a passcode needs the account password, not just the open session. */
export const setPasscodeSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(200),
  passcode: newPasscodeSchema,
});

export interface PasscodeStatus {
  set: boolean;
  updatedAt: string | null;
}
