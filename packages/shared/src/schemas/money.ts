import { z } from 'zod';

export const CURRENCIES = ['USD', 'LBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'wallet'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  wallet: 'Wallet',
};

/** A positive amount with at most two decimals. */
export const moneyAmount = z
  .number()
  .positive('Enter an amount above zero')
  .max(1e12, 'That amount is too large')
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use at most 2 decimals');

/** Rounds to cents, half up. Used for USD amounts. */
export const roundCents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Amounts of money that differ by up to this many dollars are treated as equal. Covers LBP rounding. */
export const PAYMENT_TOLERANCE_USD = 0.05;

export const formatUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const formatLbp = (n: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)} LBP`;

export const formatMoney = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUsd(amount) : formatLbp(amount);
