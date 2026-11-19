import {
  enteredPasscodeSchema,
  isWeakPasscode,
  newPasscodeSchema,
  paymentVoidSchema,
  setPasscodeSchema,
} from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { checkPasscodeHash, hashPasscode } from '../src/lib/passcode.js';

const PEPPER = 'a'.repeat(40);
const ID = '9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c';

describe('passcode hashing', () => {
  it('accepts the right passcode and refuses a wrong one', async () => {
    const stored = await hashPasscode('481926', PEPPER);
    expect(await checkPasscodeHash('481926', stored, PEPPER)).toBe(true);
    expect(await checkPasscodeHash('481927', stored, PEPPER)).toBe(false);
    expect(await checkPasscodeHash('', stored, PEPPER)).toBe(false);
  });

  it('never stores the passcode itself', async () => {
    const stored = await hashPasscode('481926', PEPPER);
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('481926');
  });

  it('gives a different hash every time (random salt), and both still verify', async () => {
    const a = await hashPasscode('481926', PEPPER);
    const b = await hashPasscode('481926', PEPPER);
    expect(a).not.toBe(b);
    expect(await checkPasscodeHash('481926', b, PEPPER)).toBe(true);
  });

  it('is useless without the pepper, so a stolen database alone cannot be cracked', async () => {
    const stored = await hashPasscode('481926', PEPPER);
    expect(await checkPasscodeHash('481926', stored, 'b'.repeat(40))).toBe(false);
  });

  it('treats an unreadable stored value as a mismatch rather than an error', async () => {
    for (const bad of ['', 'garbage', 'scrypt$1$2$3', 'bcrypt$x$y$z$a$b', 'scrypt$abc$8$1$AAAA$AAAA']) {
      expect(await checkPasscodeHash('481926', bad, PEPPER)).toBe(false);
    }
  });
});

describe('passcode rules', () => {
  it.each(['000000', '111111', '123456', '654321', '012345', '987654', '121212', '123123', '112233'])(
    'rejects the easy one %s',
    (code) => {
      expect(isWeakPasscode(code)).toBe(true);
      expect(newPasscodeSchema.safeParse(code).success).toBe(false);
    },
  );

  it.each(['481926', '730518', '209841', '593017'])('accepts %s', (code) => {
    expect(isWeakPasscode(code)).toBe(false);
    expect(newPasscodeSchema.safeParse(code).success).toBe(true);
  });

  it.each(['12345', '1234567', 'abcdef', '48 1926', '', '48192a'])('requires exactly six digits: %j', (code) => {
    expect(newPasscodeSchema.safeParse(code).success).toBe(false);
    expect(enteredPasscodeSchema.safeParse(code).success).toBe(false);
  });

  it('does not apply the easy-passcode list when one is only being entered', () => {
    // An old, easy passcode must still be usable to unlock, so only the format is checked
    expect(enteredPasscodeSchema.safeParse('123456').success).toBe(true);
  });

  it('setting a passcode needs the account password too', () => {
    expect(setPasscodeSchema.safeParse({ passcode: '481926' }).success).toBe(false);
    expect(setPasscodeSchema.safeParse({ password: '', passcode: '481926' }).success).toBe(false);
    expect(setPasscodeSchema.safeParse({ password: 'x', passcode: '481926' }).success).toBe(true);
  });
});

describe('voiding a payment', () => {
  it('needs a reason and a passcode', () => {
    expect(paymentVoidSchema.safeParse({ reason: 'Entered twice' }).success).toBe(false);
    expect(paymentVoidSchema.safeParse({ passcode: '481926' }).success).toBe(false);
    expect(paymentVoidSchema.safeParse({ reason: '', passcode: '481926' }).success).toBe(false);
    expect(paymentVoidSchema.safeParse({ reason: 'Entered twice', passcode: '481926' }).success).toBe(true);
  });
});

describe('passcode routes', () => {
  it('require login', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/me/passcode')).status).toBe(401);
    expect((await request(app).put('/api/v1/me/passcode').send({ password: 'x', passcode: '481926' })).status).toBe(401);
    expect(
      (await request(app).post(`/api/v1/payments/${ID}/void`).send({ reason: 'Entered twice', passcode: '481926' })).status,
    ).toBe(401);
  });
});

describe('missing server secret', () => {
  it('says what is wrong instead of a generic failure', async () => {
    const saved = process.env.PASSCODE_PEPPER;
    delete process.env.PASSCODE_PEPPER;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.CRON_SECRET = 'x'.repeat(16);
    const { vi } = await import('vitest');
    vi.resetModules();
    const { getPepper } = await import('../src/lib/passcode.js');
    try {
      expect(() => getPepper()).toThrowError(/PASSCODE_PEPPER/);
      try {
        getPepper();
      } catch (e) {
        expect((e as { status: number }).status).toBe(503);
      }
    } finally {
      if (saved) process.env.PASSCODE_PEPPER = saved;
    }
  });
});
