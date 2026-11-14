import { z } from 'zod';

export const IMPORT_FIELDS = [
  'fullName',
  'phone',
  'instagramHandle',
  'email',
  'source',
  'notes',
  'whatsappConsent',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  fullName: 'Name',
  phone: 'Phone',
  instagramHandle: 'Instagram',
  email: 'Email',
  source: 'Source',
  notes: 'Notes',
  whatsappConsent: 'WhatsApp consent',
};

/** Which CSV column (by position) feeds each field. null means "not in the file". */
export type ImportMapping = Partial<Record<ImportField, number | null>>;

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_CHARS = 2_000_000;

export const importRequestSchema = z.object({
  csv: z.string().min(1, 'The file is empty').max(MAX_IMPORT_CHARS, 'The file is too large'),
  mapping: z
    .partialRecord(z.enum(IMPORT_FIELDS), z.number().int().min(0).max(200).nullable())
    .optional(),
  /** Used for numbers written without a country code, such as 71 123 456 */
  defaultCountryCode: z
    .string()
    .regex(/^\+[1-9][0-9]{0,3}$/, 'Use a country code such as +961')
    .default('+961'),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate_in_file' | 'exists';

export interface ImportRowResult {
  /** Row number as a spreadsheet shows it. The header is row 1. */
  row: number;
  status: ImportRowStatus;
  reason?: string;
  fullName: string;
  phone: string;
  /** The original cells, for the error report */
  raw: string[];
}

export interface ImportCounts {
  total: number;
  valid: number;
  invalid: number;
  duplicateInFile: number;
  exists: number;
}

export interface ImportPreview {
  headers: string[];
  mapping: ImportMapping;
  counts: ImportCounts;
  sample: ImportRowResult[];
  /** Every row that will not be imported, with the reason */
  issues: ImportRowResult[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
  headers: string[];
  issues: ImportRowResult[];
}
