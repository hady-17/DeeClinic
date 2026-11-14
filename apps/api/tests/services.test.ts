import { serviceInputSchema, serviceUpdateSchema } from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const valid = {
  name: 'HydraFacial',
  category: 'skin_care',
  durationMinutes: 60,
  priceUsd: 120,
  followUpIntervalDays: 30,
};

describe('service schema', () => {
  it('accepts valid input, with or without a follow-up interval', () => {
    expect(serviceInputSchema.safeParse(valid).success).toBe(true);
    expect(serviceInputSchema.safeParse({ ...valid, followUpIntervalDays: null }).success).toBe(true);
  });

  it.each([
    ['empty name', { name: '' }],
    ['unknown category', { category: 'massage' }],
    ['duration under 5', { durationMinutes: 4 }],
    ['duration over 480', { durationMinutes: 481 }],
    ['fractional duration', { durationMinutes: 45.5 }],
    ['negative price', { priceUsd: -1 }],
    ['zero follow-up days', { followUpIntervalDays: 0 }],
  ])('rejects %s', (_label, patch) => {
    expect(serviceInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('allows a partial update and a deactivate, but not an empty one', () => {
    expect(serviceUpdateSchema.safeParse({ priceUsd: 99 }).success).toBe(true);
    expect(serviceUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(serviceUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('service routes', () => {
  it('require login', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/services')).status).toBe(401);
    expect((await request(app).post('/api/v1/services').send(valid)).status).toBe(401);
    expect(
      (await request(app).patch('/api/v1/services/9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c').send({ isActive: false })).status,
    ).toBe(401);
  });
});
