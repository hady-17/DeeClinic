import { z } from 'zod';
import { E164_REGEX } from './clinic-settings';

export const CLIENT_SOURCES = [
  'instagram',
  'whatsapp',
  'phone',
  'walk_in',
  'referral',
  'other',
] as const;

export type ClientSource = (typeof CLIENT_SOURCES)[number];

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  phone: 'Phone call',
  walk_in: 'Walk-in',
  referral: 'Referral',
  other: 'Other',
};

/** Strips spaces, dashes, dots and brackets, and turns a leading 00 into +. */
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[\s\-.()]/g, '');
  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const clientInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  phoneE164: z.preprocess(
    normalizePhone,
    z.string().regex(E164_REGEX, 'Use international format, for example +96171123456'),
  ),
  instagramHandle: z.preprocess(
    (v) => {
      const b = blankToNull(v);
      return typeof b === 'string' ? b.trim().replace(/^@/, '') : b;
    },
    z
      .string()
      .regex(/^[A-Za-z0-9._]{1,30}$/, 'Letters, numbers, dots and underscores only')
      .nullable(),
  ),
  email: z.preprocess(blankToNull, z.email('Enter a valid email').max(200).nullable()),
  source: z.preprocess(blankToNull, z.enum(CLIENT_SOURCES).nullable()),
  whatsappConsent: z.boolean(),
  notes: z.preprocess(blankToNull, z.string().trim().max(2000).nullable()),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export const clientUpdateSchema = clientInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type ClientUpdate = z.infer<typeof clientUpdateSchema>;

export interface Client extends Omit<ClientInput, 'whatsappConsent'> {
  id: string;
  whatsappConsentAt: string | null;
  /** Set when the client replied STOP. Cannot be edited by hand. */
  whatsappOptOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPage {
  data: Client[];
  nextCursor: string | null;
}
