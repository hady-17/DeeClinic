import {
  appointmentCreateSchema,
  appointmentRangeSchema,
  appointmentUpdateSchema,
} from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const ID = '9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c';
const valid = { clientId: ID, serviceId: ID, startAt: '2026-11-14T10:00:00+02:00', notes: '' };

describe('appointment schemas', () => {
  it('accepts offsets and Z, and turns blank notes into null', () => {
    expect(appointmentCreateSchema.parse(valid).notes).toBeNull();
    expect(appointmentCreateSchema.safeParse({ ...valid, startAt: '2026-11-14T08:00:00.000Z' }).success).toBe(true);
  });

  it.each([
    ['no offset', { startAt: '2026-11-14T10:00:00' }],
    ['date only', { startAt: '2026-11-14' }],
    ['bad client id', { clientId: 'abc' }],
  ])('rejects %s', (_label, patch) => {
    expect(appointmentCreateSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('requires something to update', () => {
    expect(appointmentUpdateSchema.safeParse({}).success).toBe(false);
    expect(appointmentUpdateSchema.safeParse({ startAt: valid.startAt }).success).toBe(true);
  });

  it('limits the calendar range', () => {
    const ok = { from: '2026-11-09T00:00:00Z', to: '2026-11-16T00:00:00Z' };
    expect(appointmentRangeSchema.safeParse(ok).success).toBe(true);
    expect(appointmentRangeSchema.safeParse({ from: ok.to, to: ok.from }).success).toBe(false);
    expect(appointmentRangeSchema.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-06-01T00:00:00Z' }).success).toBe(false);
  });
});

describe('appointment routes', () => {
  it('require login', async () => {
    const app = createApp();
    const base = '/api/v1/appointments';
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).post(base).send(valid)).status).toBe(401);
    expect((await request(app).patch(`${base}/${ID}`).send({ notes: 'x' })).status).toBe(401);
    for (const action of ['complete', 'no-show', 'cancel']) {
      expect((await request(app).post(`${base}/${ID}/${action}`)).status).toBe(401);
    }
  });
});
