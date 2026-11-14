import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { parseCsv } from '../src/lib/csv.js';
import {
  analyzeCsv,
  applyDefaultCountry,
  countRows,
  detectMapping,
  normalizeSource,
} from '../src/services/client-import.js';

describe('parseCsv', () => {
  it('parses quotes, escaped quotes, commas and newlines inside fields', () => {
    const { records } = parseCsv('name,notes\r\n"Haddad, Rana","said ""hi""\nthen left"\r\nSam,ok\r\n');
    expect(records.map((r) => r.cells)).toEqual([
      ['name', 'notes'],
      ['Haddad, Rana', 'said "hi"\nthen left'],
      ['Sam', 'ok'],
    ]);
  });

  it('strips a BOM and detects semicolons and tabs', () => {
    expect(parseCsv('﻿name;phone\nA;1').records[0]!.cells).toEqual(['name', 'phone']);
    expect(parseCsv('name\tphone\nA\t1').delimiter).toBe('\t');
  });

  it('skips blank lines but keeps spreadsheet row numbers', () => {
    const { records } = parseCsv('name,phone\n\nA,1\n,,\nB,2');
    expect(records.map((r) => r.line)).toEqual([1, 3, 5]);
  });
});

describe('phone and source cleanup', () => {
  it.each([
    ['71 123 456', '+96171123456'],
    ['03/123 456'.replace('/', ' '), '+9613123456'],
    ['96171123456', '+96171123456'],
    ['0096171123456', '+96171123456'],
    ['+44 7700 900123', '+447700900123'],
    ['', ''],
  ])('%s -> %s', (raw, expected) => {
    expect(applyDefaultCountry(raw, '+961')).toBe(expected);
  });

  it.each([
    ['Instagram DM', 'instagram'],
    ['walk-in', 'walk_in'],
    ['Friend', 'referral'],
    ['billboard', 'other'],
    ['', null],
  ])('source %s -> %s', (raw, expected) => {
    expect(normalizeSource(raw)).toBe(expected);
  });
});

describe('detectMapping', () => {
  it('finds columns by common header names', () => {
    const m = detectMapping(['Client Name', 'Mobile', 'Insta', 'E-mail', 'How did you find us', 'Comments']);
    expect(m).toMatchObject({ fullName: 0, phone: 1, instagramHandle: 2, email: 3, source: 4, notes: 5, whatsappConsent: null });
  });
});

describe('analyzeCsv', () => {
  const csv = [
    'Name,Phone,Instagram,Consent',
    'Rana Haddad,71 123 456,@rana.h,yes',
    'Sam Karam,"03 555 111",,',
    'Rana Again,71123456,,',
    ',70 000 000,,',
    'Bad Phone,12,,',
    'Dina,+96176000000,instagram.com/dina_k,no',
  ].join('\n');

  const a = analyzeCsv(csv, { defaultCountryCode: '+961' });
  const byRow = (n: number) => a.rows.find((r) => r.result.row === n)!;

  it('imports valid rows and normalises them', () => {
    expect(byRow(2).input).toMatchObject({
      fullName: 'Rana Haddad',
      phoneE164: '+96171123456',
      instagramHandle: 'rana.h',
      whatsappConsent: true,
    });
    expect(byRow(3).input?.phoneE164).toBe('+9613555111');
    expect(byRow(7).input).toMatchObject({ instagramHandle: 'dina_k', whatsappConsent: false });
  });

  it('records consent only when the file says yes', () => {
    expect(byRow(3).input?.whatsappConsent).toBe(false);
  });

  it('flags a duplicate inside the file and points at the first row', () => {
    expect(byRow(4).result.status).toBe('duplicate_in_file');
    expect(byRow(4).result.reason).toContain('row 2');
  });

  it('flags invalid rows with a readable reason and the right row number', () => {
    expect(byRow(5).result.status).toBe('invalid');
    expect(byRow(5).result.reason).toContain('Name');
    expect(byRow(6).result.status).toBe('invalid');
    expect(byRow(6).result.reason).toContain('Phone');
  });

  it('counts each outcome', () => {
    expect(countRows(a.rows)).toEqual({ total: 6, valid: 3, invalid: 2, duplicateInFile: 1, exists: 0 });
  });

  it('asks for a manual mapping when Name or Phone cannot be found', () => {
    const r = analyzeCsv('foo,bar\nx,y', { defaultCountryCode: '+961' });
    expect(r.mapping.fullName).toBeNull();
    expect(r.rows[0]!.result.status).toBe('invalid');
    const mapped = analyzeCsv('foo,bar\nRana,71123456', {
      defaultCountryCode: '+961',
      mapping: { fullName: 0, phone: 1 },
    });
    expect(mapped.rows[0]!.result.status).toBe('valid');
  });

  it('rejects a file with only a header', () => {
    expect(() => analyzeCsv('name,phone', { defaultCountryCode: '+961' })).toThrow();
  });
});

describe('import routes', () => {
  it('require login', async () => {
    const app = createApp();
    expect((await request(app).post('/api/v1/clients/import/preview').send({ csv: 'a' })).status).toBe(401);
    expect((await request(app).post('/api/v1/clients/import/commit').send({ csv: 'a' })).status).toBe(401);
  });
});
