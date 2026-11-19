import { z } from 'zod';

export const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const clinicSettingsInputSchema = z.object({
  name: z.string().trim().min(1, 'Clinic name is required').max(120),
  phoneE164: z.preprocess(
    blankToNull,
    z.string().regex(E164_REGEX, 'Use international format, for example +96171123456').nullable(),
  ),
  address: z.preprocess(blankToNull, z.string().trim().max(300).nullable()),
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone'),
  reminderSendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour'),
  /** Whether a no-show on a package visit uses up one of the client's sessions. */
  noShowUsesSession: z.boolean(),
});

export type ClinicSettingsInput = z.infer<typeof clinicSettingsInputSchema>;

export interface ClinicSettings extends ClinicSettingsInput {
  updatedAt: string;
}
