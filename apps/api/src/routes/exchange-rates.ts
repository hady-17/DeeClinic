import { LARGE_RATE_CHANGE, exchangeRateInputSchema, type ExchangeRates } from '@deeclinic/shared';
import { Router } from 'express';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getCurrentRate, insertRate, listRates } from '../repositories/exchange-rates.js';

export const exchangeRatesRouter = Router();

exchangeRatesRouter.use('/exchange-rates', requireAuth);

exchangeRatesRouter.get('/exchange-rates', requirePermission('rates.read'), async (_req, res) => {
  const [current, history] = await Promise.all([getCurrentRate(), listRates()]);
  const data: ExchangeRates = { current, history };
  res.json({ data });
});

/** A new rate is always a new row, in effect from now. Old rows are never edited. */
exchangeRatesRouter.post('/exchange-rates', requirePermission('rates.write'), async (req, res) => {
  const input = exchangeRateInputSchema.parse(req.body);
  const current = await getCurrentRate();

  // A guard against a slipped digit: 8,950 instead of 89,500 would misprice every LBP payment.
  if (current && !input.confirmLargeChange) {
    const change = Math.abs(input.lbpPerUsd - current.lbpPerUsd) / current.lbpPerUsd;
    if (change > LARGE_RATE_CHANGE) {
      throw AppError.businessRule(
        `This is ${Math.round(change * 100)}% different from the current rate (${current.lbpPerUsd.toLocaleString('en-US')}). Check the number, then confirm.`,
        { reason: 'RATE_CHANGE_NEEDS_CONFIRMATION', currentLbpPerUsd: current.lbpPerUsd },
      );
    }
  }

  const created = await insertRate(input.lbpPerUsd, req.user!.id);
  await writeAudit({
    actorId: req.user!.id,
    action: 'exchange_rate.set',
    entity: 'exchange_rates',
    entityId: created.id,
    before: current ? { lbpPerUsd: current.lbpPerUsd } : null,
    after: { lbpPerUsd: created.lbpPerUsd },
  });
  res.status(201).json({ data: created });
});
