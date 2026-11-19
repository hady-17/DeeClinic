import {
  can,
  exchangeRateInputSchema,
  moneyAmount,
  packageSaleSchema,
  packageTemplateInputSchema,
  paymentCreateSchema,
  paymentListQuerySchema,
  paymentVoidSchema,
  roundCents,
} from '@deeclinic/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { mapMoneyError, prepareAmount, sumMoney } from '../src/lib/money.js';
import { toPackage } from '../src/repositories/client-packages.js';

const ID = '9b2f6c1e-1c1c-4c1c-8c1c-1c1c1c1c1c1c';

describe('prepareAmount', () => {
  it('keeps USD as is, with no rate', () => {
    expect(prepareAmount('USD', 50, 89500)).toEqual({ currency: 'USD', amount: 50, rate: null, amountUsd: 50 });
  });

  it('converts LBP at the current rate and keeps the rate', () => {
    expect(prepareAmount('LBP', 895000, 89500)).toEqual({ currency: 'LBP', amount: 895000, rate: 89500, amountUsd: 10 });
  });

  it('rounds to cents, half up', () => {
    // 100000 / 89500 = 1.11731... -> 1.12
    expect(prepareAmount('LBP', 100000, 89500).amountUsd).toBe(1.12);
    // 1.005 style edge: 26850 / 89500 = 0.3 exactly
    expect(prepareAmount('LBP', 26850, 89500).amountUsd).toBe(0.3);
    // exactly half a cent rounds up: 1 / 200 = 0.005 -> 0.01
    expect(prepareAmount('LBP', 500, 100000).amountUsd).toBe(0.01);
  });

  it('refuses LBP when no rate has been set', () => {
    expect(() => prepareAmount('LBP', 90000, null)).toThrowError(/exchange rate/i);
  });

  it('refuses an LBP amount worth less than one cent', () => {
    expect(() => prepareAmount('LBP', 100, 89500)).toThrowError(/too small/i);
  });
});

describe('money helpers', () => {
  it('adds without floating point drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([])).toBe(0);
  });

  it('rounds cents', () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.675)).toBe(2.68);
  });

  it('accepts only positive amounts with up to two decimals', () => {
    expect(moneyAmount.safeParse(10.25).success).toBe(true);
    expect(moneyAmount.safeParse(0).success).toBe(false);
    expect(moneyAmount.safeParse(-5).success).toBe(false);
    expect(moneyAmount.safeParse(10.255).success).toBe(false);
  });
});

describe('database error mapping', () => {
  const run = (message: string) => {
    try {
      mapMoneyError({ message });
    } catch (e) {
      return e as { status: number; code: string; message: string };
    }
    throw new Error('did not throw');
  };

  it('explains how much is still due on an overpayment', () => {
    const e = run('OVERPAYMENT: due 400.00, already paid 380.00');
    expect(e.status).toBe(422);
    expect(e.message).toContain('$20.00');
  });

  it('maps the other known errors', () => {
    expect(run('TARGET_NOT_FOUND').status).toBe(404);
    expect(run('TARGET_CANCELLED').status).toBe(422);
    expect(run('TEMPLATE_INACTIVE').status).toBe(422);
  });

  it('rethrows what it does not know', () => {
    expect(run('something else').message).toBe('something else');
  });
});

describe('toPackage', () => {
  const base = {
    id: 'p1',
    client_id: 'c1',
    template_id: 't1',
    service_id: 's1',
    sessions_total: 5,
    price_usd: '400.00',
    purchased_at: '2026-11-01T10:00:00Z',
    expires_at: '2027-02-01T00:00:00Z',
    status: 'active' as const,
    package_templates: { name: '5x Laser' },
    services: { name: 'Laser' },
    package_usages: [{ id: 'u1' }, { id: 'u2' }],
    appointments: [{ status: 'scheduled' }, { status: 'completed' }, { status: 'cancelled' }],
    payments: [
      { amount_usd: '150.00', voided_at: null },
      { amount_usd: '50.00', voided_at: null },
      { amount_usd: '100.00', voided_at: '2026-11-02T00:00:00Z' },
    ],
  };
  const now = new Date('2026-12-01T00:00:00Z');

  it('counts used, remaining and what is free to book', () => {
    const p = toPackage(base, now);
    expect(p.sessionsUsed).toBe(2);
    expect(p.sessionsRemaining).toBe(3);
    // one of the 3 is already promised to a booked, not-yet-done visit
    expect(p.sessionsAvailableToBook).toBe(2);
  });

  it('ignores voided payments when working out what was paid', () => {
    expect(toPackage(base, now).paidUsd).toBe(200);
  });

  it('reports a package as expired from its date, with nothing left to book', () => {
    const p = toPackage(base, new Date('2027-03-01T00:00:00Z'));
    expect(p.status).toBe('expired');
    expect(p.sessionsAvailableToBook).toBe(0);
  });

  it('keeps a completed package completed', () => {
    const p = toPackage({ ...base, status: 'completed' as const, package_usages: Array.from({ length: 5 }, (_, i) => ({ id: `u${i}` })) }, now);
    expect(p.status).toBe('completed');
    expect(p.sessionsRemaining).toBe(0);
  });
});

describe('money schemas', () => {
  it('payments are for exactly one thing', () => {
    const base = { currency: 'USD', amount: 20 };
    expect(paymentCreateSchema.safeParse({ ...base, appointmentId: ID }).success).toBe(true);
    expect(paymentCreateSchema.safeParse({ ...base, clientPackageId: ID }).success).toBe(true);
    expect(paymentCreateSchema.safeParse(base).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ ...base, appointmentId: ID, clientPackageId: ID }).success).toBe(false);
  });

  it('defaults the method to cash and rejects unknown currencies', () => {
    expect(paymentCreateSchema.parse({ currency: 'LBP', amount: 90000, appointmentId: ID }).method).toBe('cash');
    expect(paymentCreateSchema.safeParse({ currency: 'EUR', amount: 5, appointmentId: ID }).success).toBe(false);
  });

  it('a void needs a reason and a passcode', () => {
    expect(paymentVoidSchema.safeParse({ reason: '', passcode: '481926' }).success).toBe(false);
    expect(paymentVoidSchema.safeParse({ reason: 'Entered twice', passcode: '481926' }).success).toBe(true);
  });

  it('listing payments needs a filter', () => {
    expect(paymentListQuerySchema.safeParse({}).success).toBe(false);
    expect(paymentListQuerySchema.safeParse({ clientId: ID }).success).toBe(true);
  });

  it('package templates need at least two sessions', () => {
    const t = { name: '5x Laser', serviceId: ID, sessionCount: 5, priceUsd: 400, validityDays: 180 };
    expect(packageTemplateInputSchema.safeParse(t).success).toBe(true);
    expect(packageTemplateInputSchema.safeParse({ ...t, sessionCount: 1 }).success).toBe(false);
    expect(packageTemplateInputSchema.safeParse({ ...t, validityDays: 0 }).success).toBe(false);
  });

  it('a sale may carry a first payment', () => {
    expect(packageSaleSchema.safeParse({ clientId: ID, templateId: ID }).success).toBe(true);
    expect(packageSaleSchema.safeParse({ clientId: ID, templateId: ID, payment: { currency: 'USD', amount: 100 } }).success).toBe(true);
  });

  it('exchange rates must be positive with two decimals at most', () => {
    expect(exchangeRateInputSchema.safeParse({ lbpPerUsd: 89500 }).success).toBe(true);
    expect(exchangeRateInputSchema.safeParse({ lbpPerUsd: 0 }).success).toBe(false);
    expect(exchangeRateInputSchema.safeParse({ lbpPerUsd: 89500.123 }).success).toBe(false);
  });
});

describe('money permissions', () => {
  it('staff take payments but cannot void them or change rates and offers', () => {
    expect(can('staff', 'payments.record')).toBe(true);
    expect(can('staff', 'packages.sell')).toBe(true);
    expect(can('staff', 'payments.void')).toBe(false);
    expect(can('staff', 'rates.write')).toBe(false);
    expect(can('staff', 'packages.manage')).toBe(false);
  });

  it('managers correct money and run the catalog', () => {
    expect(can('manager', 'payments.void')).toBe(true);
    expect(can('manager', 'rates.write')).toBe(true);
    expect(can('manager', 'packages.manage')).toBe(true);
  });
});

describe('money routes', () => {
  it('require login', async () => {
    const app = createApp();
    const get = (p: string) => request(app).get(`/api/v1${p}`);
    expect((await get('/exchange-rates')).status).toBe(401);
    expect((await get('/package-templates')).status).toBe(401);
    expect((await get(`/clients/${ID}/packages`)).status).toBe(401);
    expect((await get(`/client-packages/${ID}`)).status).toBe(401);
    expect((await get(`/payments?clientId=${ID}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/exchange-rates').send({ lbpPerUsd: 89500 })).status).toBe(401);
    expect((await request(app).post('/api/v1/package-templates').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/client-packages').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/payments').send({})).status).toBe(401);
    expect((await request(app).post(`/api/v1/payments/${ID}/void`).send({ reason: 'x', passcode: '481926' })).status).toBe(401);
  });
});
