import {
  CLIENT_SOURCES,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  clientInputSchema,
  type ClientInput,
  type ImportCounts,
  type ImportField,
  type ImportMapping,
  type ImportRowResult,
} from '@deeclinic/shared';
import { parseCsv } from '../lib/csv.js';
import { AppError } from '../lib/errors.js';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const SYNONYMS: Record<ImportField, string[]> = {
  fullName: ['name', 'fullname', 'clientname', 'client', 'customer', 'customername', 'patient'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'whatsapp', 'whatsappnumber', 'tel', 'telephone', 'cell', 'contact', 'number'],
  instagramHandle: ['instagram', 'insta', 'ig', 'instagramhandle', 'instagramusername'],
  email: ['email', 'emailaddress', 'mail'],
  source: ['source', 'howdidyoufindus', 'referralsource', 'channel', 'leadsource'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
  whatsappConsent: ['consent', 'whatsappconsent', 'optin', 'whatsappoptin'],
};

/** Guesses which column feeds each field, using common header names. */
export function detectMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  const normalized = headers.map(norm);
  for (const field of IMPORT_FIELDS) {
    const idx = normalized.findIndex((h, i) => !used.has(i) && SYNONYMS[field].includes(h));
    mapping[field] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return mapping;
}

/**
 * Adds a country code to numbers written without one.
 * "71 123 456" -> +96171123456, "03 123 456" -> +9613123456,
 * "96171123456" -> +96171123456, "+44 7700 900123" is left alone.
 */
export function applyDefaultCountry(raw: string, countryCode: string): string {
  const cleaned = raw.replace(/[\s\-.()]/g, '');
  if (cleaned === '') return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  const cc = countryCode.slice(1);
  if (cleaned.startsWith(cc) && cleaned.length >= cc.length + 7) return `+${cleaned}`;
  return `${countryCode}${cleaned.replace(/^0+/, '')}`;
}

export function normalizeSource(raw: string): ClientInput['source'] {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const snake = v.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if ((CLIENT_SOURCES as readonly string[]).includes(snake)) return snake as ClientInput['source'];
  if (v.includes('insta')) return 'instagram';
  if (v.includes('whats')) return 'whatsapp';
  if (v.includes('walk')) return 'walk_in';
  if (v.includes('refer') || v.includes('friend')) return 'referral';
  if (v.includes('phone') || v.includes('call')) return 'phone';
  return 'other';
}

const YES = new Set(['yes', 'y', 'true', '1', 'x', 'agreed', 'consent']);
const parseYes = (raw: string) => YES.has(raw.trim().toLowerCase());

/** Accepts @handle, a bare handle, or an instagram.com link. */
function cleanHandle(raw: string): string {
  const url = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return (url?.[1] ?? raw).trim();
}

const FIELD_NAME: Record<string, string> = {
  fullName: 'Name',
  phoneE164: 'Phone',
  instagramHandle: 'Instagram',
  email: 'Email',
  source: 'Source',
  notes: 'Notes',
  whatsappConsent: 'Consent',
};

export interface AnalyzedRow {
  result: ImportRowResult;
  /** Present only when the row is valid so far */
  input?: ClientInput;
}

export interface Analysis {
  headers: string[];
  mapping: ImportMapping;
  rows: AnalyzedRow[];
}

export function analyzeCsv(
  csv: string,
  opts: { mapping?: ImportMapping; defaultCountryCode: string },
): Analysis {
  const { records } = parseCsv(csv);
  const header = records[0];
  if (!header) throw AppError.validation('The file has no rows.');
  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) throw AppError.validation('The file has a header but no clients.');
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    throw AppError.validation(`The file has ${dataRecords.length} rows. The limit is ${MAX_IMPORT_ROWS}.`);
  }

  const headers = header.cells.map((h) => h.trim());
  const detected = detectMapping(headers);
  const mapping: ImportMapping = {};
  for (const f of IMPORT_FIELDS) {
    const chosen = opts.mapping?.[f];
    mapping[f] = chosen === undefined ? (detected[f] ?? null) : chosen;
  }
  if (mapping.fullName == null || mapping.phone == null) {
    // Still return the analysis so the owner can map the columns by hand
    return {
      headers,
      mapping,
      rows: dataRecords.map((r) => ({
        result: {
          row: r.line,
          status: 'invalid',
          reason: 'Choose the Name and Phone columns first.',
          fullName: '',
          phone: '',
          raw: r.cells,
        },
      })),
    };
  }

  const cell = (cells: string[], field: ImportField) => {
    const idx = mapping[field];
    return idx == null ? '' : (cells[idx] ?? '').trim();
  };

  const seenPhones = new Map<string, number>();
  const rows: AnalyzedRow[] = dataRecords.map((r) => {
    const name = cell(r.cells, 'fullName');
    const rawPhone = cell(r.cells, 'phone');
    const base = { row: r.line, fullName: name, phone: rawPhone, raw: r.cells };

    const parsed = clientInputSchema.safeParse({
      fullName: name,
      phoneE164: applyDefaultCountry(rawPhone, opts.defaultCountryCode),
      instagramHandle: cleanHandle(cell(r.cells, 'instagramHandle')),
      email: cell(r.cells, 'email'),
      source: normalizeSource(cell(r.cells, 'source')),
      // Consent is only recorded when the file explicitly says yes
      whatsappConsent: parseYes(cell(r.cells, 'whatsappConsent')),
      notes: cell(r.cells, 'notes'),
    });

    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((i) => `${FIELD_NAME[String(i.path[0])] ?? 'Row'}: ${i.message}`)
        .join('. ');
      return { result: { ...base, status: 'invalid', reason } };
    }

    const phone = parsed.data.phoneE164;
    const first = seenPhones.get(phone);
    if (first !== undefined) {
      return {
        result: { ...base, phone, status: 'duplicate_in_file', reason: `Same phone number as row ${first}.` },
      };
    }
    seenPhones.set(phone, r.line);
    return { result: { ...base, phone, status: 'valid' }, input: parsed.data };
  });

  return { headers, mapping, rows };
}

export function countRows(rows: AnalyzedRow[]): ImportCounts {
  const counts: ImportCounts = { total: rows.length, valid: 0, invalid: 0, duplicateInFile: 0, exists: 0 };
  for (const { result } of rows) {
    if (result.status === 'valid') counts.valid++;
    else if (result.status === 'invalid') counts.invalid++;
    else if (result.status === 'duplicate_in_file') counts.duplicateInFile++;
    else counts.exists++;
  }
  return counts;
}
