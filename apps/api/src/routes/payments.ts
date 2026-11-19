import { paymentCreateSchema, paymentListQuerySchema, paymentVoidSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit, writeAuditQuietly } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { prepareAmount } from '../lib/money.js';
import { assertPasscode } from '../lib/passcode.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getCurrentRate } from '../repositories/exchange-rates.js';
import { getPayment, listPayments, recordPayment, voidPayment } from '../repositories/payments.js';

export const paymentsRouter = Router();

const idSchema = z.uuid();

paymentsRouter.use('/payments', requireAuth);

paymentsRouter.get('/payments', requirePermission('payments.read'), async (req, res) => {
  res.json({ data: await listPayments(paymentListQuerySchema.parse(req.query)) });
});

/**
 * Records a payment for one appointment or one package. LBP is converted at the current
 * rate, and the rate is stored with the payment. The database refuses to take more than
 * is owed, even if two payments arrive at the same moment.
 */
paymentsRouter.post('/payments', requirePermission('payments.record'), async (req, res) => {
  const input = paymentCreateSchema.parse(req.body);
  await withIdempotency(req, res, async () => {
    const rate = input.currency === 'LBP' ? ((await getCurrentRate())?.lbpPerUsd ?? null) : null;
    const prepared = prepareAmount(input.currency, input.amount, rate);

    const id = await recordPayment({
      appointmentId: input.appointmentId,
      clientPackageId: input.clientPackageId,
      ...prepared,
      method: input.method,
      recordedBy: req.user!.id,
    });
    const created = await getPayment(id);
    await writeAudit({
      actorId: req.user!.id,
      action: 'payment.record',
      entity: 'payments',
      entityId: id,
      after: {
        id,
        appointmentId: input.appointmentId ?? null,
        clientPackageId: input.clientPackageId ?? null,
        currency: prepared.currency,
        amount: prepared.amount,
        rate: prepared.rate,
        amountUsd: prepared.amountUsd,
      },
    });
    return { status: 201, body: { data: created } };
  });
});

/**
 * Voiding keeps the payment on record, with who, when and why. Payments are never deleted.
 * It needs two things: the permission, and the signed-in person's own passcode. A stolen or
 * left-open login session therefore cannot void money on its own.
 */
paymentsRouter.post('/payments/:id/void', requirePermission('payments.void'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { reason, passcode } = paymentVoidSchema.parse(req.body);

  try {
    await assertPasscode(req.user!.id, passcode);
  } catch (err) {
    // A wrong passcode or a lockout is worth a record. The passcode itself is never logged.
    if (err instanceof AppError && (err.code === 'PASSCODE_INVALID' || err.code === 'RATE_LIMITED')) {
      await writeAuditQuietly({
        actorId: req.user!.id,
        action: 'payment.void_denied',
        entity: 'payments',
        entityId: id,
        after: { reason: err.code },
      });
    }
    throw err;
  }

  const before = await getPayment(id);
  if (!before) throw AppError.notFound('Payment not found.');
  if (before.voidedAt) throw AppError.businessRule('This payment is already void.');

  const after = await voidPayment(id, reason);
  if (!after) throw AppError.businessRule('This payment is already void.');
  await writeAudit({
    actorId: req.user!.id,
    action: 'payment.void',
    entity: 'payments',
    entityId: id,
    before: { amountUsd: before.amountUsd, currency: before.currency },
    after: { voidReason: reason, approvedWithPasscode: true },
  });
  res.json({ data: after });
});
