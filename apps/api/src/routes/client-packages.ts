import { packageSaleSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { prepareAmount } from '../lib/money.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getClientPackage, listClientPackages, sellPackage } from '../repositories/client-packages.js';
import { getClient } from '../repositories/clients.js';
import { getCurrentRate } from '../repositories/exchange-rates.js';

export const clientPackagesRouter = Router();

const idSchema = z.uuid();

clientPackagesRouter.get('/clients/:id/packages', requireAuth, requirePermission('packages.read'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  if (!(await getClient(id))) throw AppError.notFound('Client not found.');
  res.json({ data: await listClientPackages(id) });
});

clientPackagesRouter.use('/client-packages', requireAuth);

clientPackagesRouter.get('/client-packages/:id', requirePermission('packages.read'), async (req, res) => {
  const pkg = await getClientPackage(idSchema.parse(req.params.id));
  if (!pkg) throw AppError.notFound('Package not found.');
  res.json({ data: pkg });
});

/**
 * Sells a package. The sessions, price and expiry are copied from the template at this
 * moment. A payment taken at the same time is saved in the same transaction.
 */
clientPackagesRouter.post('/client-packages', requirePermission('packages.sell'), async (req, res) => {
  const input = packageSaleSchema.parse(req.body);
  await withIdempotency(req, res, async () => {
    if (!(await getClient(input.clientId))) throw AppError.notFound('Client not found.');

    let payment;
    if (input.payment) {
      const rate = input.payment.currency === 'LBP' ? ((await getCurrentRate())?.lbpPerUsd ?? null) : null;
      const prepared = prepareAmount(input.payment.currency, input.payment.amount, rate);
      payment = { ...prepared, method: input.payment.method };
    }

    const id = await sellPackage({
      clientId: input.clientId,
      templateId: input.templateId,
      recordedBy: req.user!.id,
      payment,
    });
    const created = await getClientPackage(id);
    await writeAudit({
      actorId: req.user!.id,
      action: 'package.sell',
      entity: 'client_packages',
      entityId: id,
      after: {
        id,
        clientId: input.clientId,
        templateId: input.templateId,
        sessions: created?.sessionsTotal,
        priceUsd: created?.priceUsd,
        paidAtSaleUsd: payment?.amountUsd ?? 0,
      },
    });
    return { status: 201, body: { data: created } };
  });
});
