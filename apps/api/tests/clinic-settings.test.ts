import { clinicSettingsInputSchema } from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const valid = {
  name: 'Dee Clinic',
  phoneE164: '+96171123456',
  address: 'Beirut',
  timezone: 'Asia/Beirut',
  reminderSendTime: '10:00',
};

describe('clinic settings schema', () => {
  it('accepts valid input', () => {
    expect(clinicSettingsInputSchema.safeParse(valid).success).toBe(true);
  });

  it('turns blank phone and address into null', () => {
    const r = clinicSettingsInputSchema.parse({ ...valid, phoneE164: '', address: '  ' });
    expect(r.phoneE164).toBeNull();
    expect(r.address).toBeNull();
  });

  it.each([
    ['empty name', { name: ' ' }],
    ['local phone format', { phoneE164: '071123456' }],
    ['unknown timezone', { timezone: 'Mars/Base' }],
    ['bad time', { reminderSendTime: '25:00' }],
  ])('rejects %s', (_label, patch) => {
    expect(clinicSettingsInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('clinic settings routes', () => {
  it('require login', async () => {
    expect((await request(createApp()).get('/api/v1/clinic-settings')).status).toBe(401);
    expect((await request(createApp()).put('/api/v1/clinic-settings').send(valid)).status).toBe(401);
  });
});
