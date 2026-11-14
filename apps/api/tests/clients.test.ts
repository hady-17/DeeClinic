import { clientInputSchema, clientUpdateSchema, normalizePhone } from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const valid = {
  fullName: 'Rana Haddad',
  phoneE164: '+96171123456',
  instagramHandle: null,
  email: null,
  source: 'instagram',
  whatsappConsent: true,
  notes: null,
};

describe('phone normalisation', () => {
  it.each([
    ['+961 71 123 456', '+96171123456'],
    ['+961-71-123-456', '+96171123456'],
    ['0096171123456', '+96171123456'],
    ['(+961) 71.123.456', '+96171123456'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe('client schema', () => {
  it('accepts valid input and cleans the phone number', () => {
    const r = clientInputSchema.parse({ ...valid, phoneE164: '+961 71 123 456' });
    expect(r.phoneE164).toBe('+96171123456');
  });

  it('turns blank optional fields into null and strips @ from the handle', () => {
    const r = clientInputSchema.parse({
      ...valid,
      instagramHandle: '@rana.h',
      email: '',
      source: '',
      notes: '  ',
    });
    expect(r.instagramHandle).toBe('rana.h');
    expect(r.email).toBeNull();
    expect(r.source).toBeNull();
    expect(r.notes).toBeNull();
  });

  it.each([
    ['empty name', { fullName: ' ' }],
    ['local phone without country code', { phoneE164: '71123456' }],
    ['letters in phone', { phoneE164: '+961abc' }],
    ['bad email', { email: 'not-an-email' }],
    ['bad handle', { instagramHandle: 'has spaces' }],
    ['unknown source', { source: 'billboard' }],
    ['missing consent flag', { whatsappConsent: undefined }],
  ])('rejects %s', (_label, patch) => {
    expect(clientInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('allows partial updates but not empty ones', () => {
    expect(clientUpdateSchema.safeParse({ notes: 'Prefers mornings' }).success).toBe(true);
    expect(clientUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('client routes', () => {
  it('require login', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/clients')).status).toBe(401);
    expect((await request(app).post('/api/v1/clients').send(valid)).status).toBe(401);
    expect((await request(app).get('/api/v1/clients/9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c')).status).toBe(401);
  });
});
