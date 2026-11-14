import { z } from 'zod';
import { ROLES, type Role } from './permissions';

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd123', 'qwertyuiop',
  'qwerty12345', '1234567890', '12345678910', '0123456789', 'letmein123', 'welcome123',
  'admin12345', 'iloveyou12', 'abc1234567', 'changeme123', 'clinic12345', 'deeclinic1',
]);

/**
 * Length matters more than symbols. At least 10 characters, not a well-known
 * password, not one repeated character. The API also rejects a password that
 * contains the account's own email name.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'That password is too common')
  .refine((p) => new Set(p).size >= 5, 'Use a wider mix of characters');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(200));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const setPasswordSchema = z.object({ password: passwordSchema });

export const userCreateSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  role: z.enum(ROLES),
  /** Leave out to send an invite email, so the person chooses their own password. */
  password: passwordSchema.optional(),
});

export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Name is required').max(120),
    role: z.enum(ROLES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type UserUpdate = z.infer<typeof userUpdateSchema>;

/**
 * True if the password contains the name part of the email, either all of it or any
 * word in it of 4 or more letters ("maria.santos" rules out "maria" and "santos").
 */
export function passwordContainsEmail(password: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  const pw = password.toLowerCase();
  const words = local.split(/[^a-z]+/).filter((w) => w.length >= 4);
  return (local.length >= 4 && pw.includes(local)) || words.some((w) => pw.includes(w));
}

export interface UserSummary {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface Me {
  id: string;
  email: string | undefined;
  fullName: string;
  role: Role;
  permissions: string[];
}
