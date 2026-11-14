import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  can,
  loginSchema,
  passwordContainsEmail,
  passwordSchema,
  userCreateSchema,
  userUpdateSchema,
} from '@deeclinic/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/lib/errors.js';
import { isPasswordOnlySession, sessionMethods } from '../src/lib/jwt.js';
import { MemoryStore, checkLimit, rateLimit } from '../src/lib/rate-limit.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requirePermission } from '../src/middleware/auth.js';

describe('permission matrix', () => {
  it('lets the owner do everything', () => {
    for (const p of PERMISSIONS) expect(can('owner', p)).toBe(true);
  });

  it('keeps user management with the owner only', () => {
    expect(can('owner', 'users.manage')).toBe(true);
    expect(can('manager', 'users.manage')).toBe(false);
    expect(can('staff', 'users.manage')).toBe(false);
  });

  it('gives staff day-to-day work but not setup', () => {
    for (const p of ['clients.read', 'clients.write', 'appointments.write', 'notes.write'] as const) {
      expect(can('staff', p)).toBe(true);
    }
    for (const p of ['services.write', 'settings.write', 'clients.import', 'users.manage'] as const) {
      expect(can('staff', p)).toBe(false);
    }
  });

  it('lets managers run the clinic but not manage users', () => {
    expect(can('manager', 'services.write')).toBe(true);
    expect(can('manager', 'clients.import')).toBe(true);
    expect(can('manager', 'settings.write')).toBe(true);
  });

  it('never gives a lower role something a higher role lacks', () => {
    for (const p of ROLE_PERMISSIONS.staff) expect(can('manager', p)).toBe(true);
    for (const p of ROLE_PERMISSIONS.manager) expect(can('owner', p)).toBe(true);
  });

  it('knows every role', () => {
    expect([...ROLES]).toEqual(['owner', 'manager', 'staff']);
  });
});

describe('requirePermission', () => {
  const run = (role: 'owner' | 'manager' | 'staff', permission: 'users.manage' | 'clients.read') => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'u', email: 'a@b.co', role, fullName: 'T', token: 't' };
      next();
    });
    app.get('/x', requirePermission(permission), (_req, res) => void res.json({ ok: true }));
    app.use(errorHandler);
    return request(app).get('/x');
  };

  it('allows and refuses by permission', async () => {
    expect((await run('owner', 'users.manage')).status).toBe(200);
    expect((await run('staff', 'users.manage')).status).toBe(403);
    expect((await run('staff', 'clients.read')).status).toBe(200);
  });
});

describe('password policy', () => {
  it('accepts a long passphrase', () => {
    expect(passwordSchema.safeParse('correct horse battery').success).toBe(true);
  });

  it.each([
    ['too short', 'Ab1!xyz'],
    ['too long', 'a1'.repeat(40)],
    ['well-known', 'Password123'],
    ['one repeated character', 'aaaaaaaaaaaa'],
    ['too few different characters', 'abababababab'],
  ])('rejects %s', (_label, pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });

  it('rejects a password containing the email name', () => {
    expect(passwordContainsEmail('rana.haddad-2026!', 'rana.haddad@clinic.com')).toBe(true);
    expect(passwordContainsEmail('purple-giraffe-lamp', 'rana.haddad@clinic.com')).toBe(false);
    expect(passwordContainsEmail('abcdef', 'ab@clinic.com')).toBe(false); // too short to be meaningful
    // Any word of the name counts, not just the whole thing
    expect(passwordContainsEmail('Haddad-2026-sunny', 'rana.haddad@clinic.com')).toBe(true);
    expect(passwordContainsEmail('maria.santos-2026!', 'maria.santos7x2@clinic.com')).toBe(true);
  });
});

describe('auth schemas', () => {
  it('lowercases and trims emails', () => {
    expect(loginSchema.parse({ email: '  Rana@Clinic.COM ', password: 'x' }).email).toBe('rana@clinic.com');
  });

  it('validates new users', () => {
    const ok = { email: 'a@b.co', fullName: 'A', role: 'staff' };
    expect(userCreateSchema.safeParse(ok).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...ok, role: 'admin' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...ok, password: 'short' }).success).toBe(false);
    expect(userUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit, then refuses', async () => {
    const store = new MemoryStore();
    const opts = { name: 't', value: 'a@b.co', limit: 3, windowSeconds: 60, store };
    for (let i = 0; i < 3; i++) await checkLimit(opts);
    await expect(checkLimit(opts)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  });

  it('counts each key separately', async () => {
    const store = new MemoryStore();
    const base = { name: 't', limit: 1, windowSeconds: 60, store };
    await checkLimit({ ...base, value: 'one' });
    await expect(checkLimit({ ...base, value: 'two' })).resolves.toBeUndefined();
    await expect(checkLimit({ ...base, value: 'one' })).rejects.toBeInstanceOf(AppError);
  });

  it('forgets a key once it is reset (a successful login clears the counter)', async () => {
    const store = new MemoryStore();
    await store.hit('k', 60);
    await store.hit('k', 60);
    await store.reset('k');
    expect(await store.hit('k', 60)).toBe(1);
  });

  it('answers 429 with Retry-After from the middleware', async () => {
    const app = express();
    app.get('/x', rateLimit({ name: 'x', limit: 2, windowSeconds: 60, store: new MemoryStore() }), (_q, r) => void r.send('ok'));
    app.use(errorHandler);
    await request(app).get('/x');
    await request(app).get('/x');
    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('60');
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('fails closed or open when the store is down, as configured', async () => {
    const broken = { hit: async () => { throw new Error('db down'); }, reset: async () => undefined };
    const build = (failOpen: boolean) => {
      const app = express();
      app.get('/x', rateLimit({ name: 'x', limit: 1, windowSeconds: 60, store: broken, failOpen }), (_q, r) => void r.send('ok'));
      app.use(errorHandler);
      return app;
    };
    expect((await request(build(true)).get('/x')).status).toBe(200);
    expect((await request(build(false)).get('/x')).status).toBe(500);
  });
});

describe('session method detection', () => {
  const token = (amr: { method: string }[]) =>
    `h.${Buffer.from(JSON.stringify({ amr })).toString('base64url')}.s`;

  it('tells a password login from an emailed-link session', () => {
    expect(isPasswordOnlySession(token([{ method: 'password' }]))).toBe(true);
    expect(isPasswordOnlySession(token([{ method: 'otp' }]))).toBe(false);
    expect(isPasswordOnlySession(token([{ method: 'password' }, { method: 'otp' }]))).toBe(false);
  });

  it('does not treat a malformed token as a password session', () => {
    expect(sessionMethods('garbage')).toEqual([]);
    expect(isPasswordOnlySession('garbage')).toBe(false);
  });
});

describe('auth and user routes', () => {
  const app = createApp();

  it('reject bad login input before touching Supabase', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nope', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reject bad forgot-password input', async () => {
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: 'x' })).status).toBe(400);
  });

  it('require a token to set a password', async () => {
    const res = await request(app).post('/api/v1/auth/set-password').send({ password: 'correct horse battery' });
    expect(res.status).toBe(401);
  });

  it('require login for every user-management route', async () => {
    const id = '9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c';
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
    expect((await request(app).post('/api/v1/users').send({})).status).toBe(401);
    expect((await request(app).patch(`/api/v1/users/${id}`).send({ role: 'staff' })).status).toBe(401);
    expect((await request(app).post(`/api/v1/users/${id}/deactivate`)).status).toBe(401);
    expect((await request(app).post(`/api/v1/users/${id}/reactivate`)).status).toBe(401);
    expect((await request(app).delete(`/api/v1/users/${id}`)).status).toBe(401);
  });

  it('keep the health check outside the rate limit', async () => {
    for (let i = 0; i < 5; i++) expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});
