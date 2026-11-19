import type { Currency } from '@deeclinic/shared';
import Decimal from 'decimal.js';
import { AppError } from './errors.js';

export interface PreparedAmount {
  currency: Currency;
  amount: number;
  /** LBP per USD used for the conversion. null for USD. */
  rate: number | null;
  amountUsd: number;
}

/**
 * Works out the US dollar value of a payment. LBP is converted at the rate in effect
 * right now, and that rate is kept with the payment so past reports never change when
 * the rate does. Rounds to cents, half up.
 */
export function prepareAmount(currency: Currency, amount: number, currentRate: number | null): PreparedAmount {
  if (currency === 'USD') return { currency, amount, rate: null, amountUsd: amount };

  if (!currentRate) {
    throw AppError.businessRule('Set the LBP exchange rate before taking a payment in LBP.', {
      reason: 'NO_EXCHANGE_RATE',
    });
  }
  const usd = new Decimal(amount).div(currentRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  if (usd < 0.01) throw AppError.validation('That LBP amount is too small to record.');
  return { currency, amount, rate: currentRate, amountUsd: usd };
}

/** Sum of money amounts without floating point drift. */
export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0)).toDecimalPlaces(2).toNumber();
}

/** Turns the database's payment and package errors into clear API errors. */
export function mapMoneyError(error: { message?: string }): never {
  const m = error.message ?? '';
  if (m.includes('OVERPAYMENT')) {
    const match = m.match(/due ([\d.]+), already paid ([\d.]+)/);
    const stillDue = match ? Math.max(Number(match[1]) - Number(match[2]), 0) : null;
    throw AppError.businessRule(
      stillDue === null
        ? 'That is more than is owed.'
        : `That is more than is owed. Only $${stillDue.toFixed(2)} is still due.`,
      { reason: 'OVERPAYMENT', stillDueUsd: stillDue },
    );
  }
  if (m.includes('TARGET_NOT_FOUND') || m.includes('CLIENT_NOT_FOUND') || m.includes('TEMPLATE_NOT_FOUND')) {
    throw AppError.notFound('Not found.');
  }
  if (m.includes('TARGET_CANCELLED')) {
    throw AppError.businessRule('This is cancelled, so it cannot take a payment.');
  }
  if (m.includes('TEMPLATE_INACTIVE')) {
    throw AppError.businessRule('This package is no longer offered.');
  }
  throw error;
}
