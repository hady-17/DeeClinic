import { z } from 'zod';
import { CURRENCIES, PAYMENT_METHODS, moneyAmount, type Currency, type PaymentMethod } from './money';
import { enteredPasscodeSchema } from './passcode';

export const paymentInputSchema = z.object({
  currency: z.enum(CURRENCIES),
  amount: moneyAmount,
  method: z.enum(PAYMENT_METHODS).default('cash'),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

/** A payment is for one appointment or one package sale, never both. */
export const paymentCreateSchema = paymentInputSchema
  .extend({
    appointmentId: z.uuid().optional(),
    clientPackageId: z.uuid().optional(),
  })
  .refine(
    (p) => Number(Boolean(p.appointmentId)) + Number(Boolean(p.clientPackageId)) === 1,
    'Choose either an appointment or a package',
  );

export type PaymentCreate = z.infer<typeof paymentCreateSchema>;

export const paymentVoidSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
  /** The signed-in owner's or manager's own passcode. A login session alone is not enough. */
  passcode: enteredPasscodeSchema,
});

export const paymentListQuerySchema = z
  .object({
    clientId: z.uuid().optional(),
    appointmentId: z.uuid().optional(),
    clientPackageId: z.uuid().optional(),
  })
  .refine((q) => Boolean(q.clientId || q.appointmentId || q.clientPackageId), 'Filter by client, appointment or package');

export interface Payment {
  id: string;
  clientId: string;
  appointmentId: string | null;
  clientPackageId: string | null;
  /** What the payment was for, in words: the service or the package name */
  forLabel: string;
  currency: Currency;
  amount: number;
  /** LBP per USD at the moment of payment. null for USD payments. */
  exchangeRate: number | null;
  amountUsd: number;
  method: PaymentMethod;
  paidAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}
