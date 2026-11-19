import { z } from 'zod';

export const exchangeRateInputSchema = z.object({
  lbpPerUsd: z
    .number()
    .min(1, 'Enter how many LBP equal one US dollar')
    .max(10_000_000, 'That rate looks too high')
    .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use at most 2 decimals'),
  /** Needed when the new rate differs from the current one by more than 20 percent. */
  confirmLargeChange: z.boolean().optional(),
});

export type ExchangeRateInput = z.infer<typeof exchangeRateInputSchema>;

/** A change bigger than this needs an explicit confirmation, as a guard against typos. */
export const LARGE_RATE_CHANGE = 0.2;

export interface ExchangeRate {
  id: string;
  lbpPerUsd: number;
  effectiveFrom: string;
  setBy: string | null;
  setByName: string | null;
  createdAt: string;
}

export interface ExchangeRates {
  /** The latest rate whose effective date has passed. null until the first one is set. */
  current: ExchangeRate | null;
  history: ExchangeRate[];
}
