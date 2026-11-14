import { visitNoteCreateSchema, visitNoteUpdateSchema } from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const ID = '9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c';

describe('visit note schemas', () => {
  it('accepts a note and turns blank products into null', () => {
    const r = visitNoteCreateSchema.parse({ appointmentId: ID, body: ' Skin calm. ', productsUsed: '' });
    expect(r.body).toBe('Skin calm.');
    expect(r.productsUsed).toBeNull();
  });

  it('defaults products to null when omitted', () => {
    expect(visitNoteCreateSchema.parse({ appointmentId: ID, body: 'x' }).productsUsed).toBeNull();
  });

  it.each([
    ['empty body', { body: '   ' }],
    ['bad appointment id', { appointmentId: 'nope' }],
    ['body too long', { body: 'x'.repeat(5001) }],
  ])('rejects %s', (_label, patch) => {
    expect(visitNoteCreateSchema.safeParse({ appointmentId: ID, body: 'ok', ...patch }).success).toBe(false);
  });

  it('requires something to update', () => {
    expect(visitNoteUpdateSchema.safeParse({}).success).toBe(false);
    expect(visitNoteUpdateSchema.safeParse({ body: 'edited' }).success).toBe(true);
  });
});

describe('visit note and history routes', () => {
  it('require login', async () => {
    const app = createApp();
    expect((await request(app).get(`/api/v1/visit-notes?appointmentId=${ID}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/visit-notes').send({ appointmentId: ID, body: 'x' })).status).toBe(401);
    expect((await request(app).patch(`/api/v1/visit-notes/${ID}`).send({ body: 'x' })).status).toBe(401);
    expect((await request(app).get(`/api/v1/clients/${ID}/history`)).status).toBe(401);
  });
});
