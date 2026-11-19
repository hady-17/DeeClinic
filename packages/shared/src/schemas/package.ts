import { z } from 'zod';
import { paymentInputSchema } from './payment';

export const packageTemplateInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  serviceId: z.uuid('Choose a service'),
  sessionCount: z.number().int('Whole sessions only').min(2, 'A package has at least 2 sessions').max(100),
  priceUsd: z.number().min(0, 'Price cannot be negative').max(100000),
  validityDays: z.number().int('Whole days only').min(1, 'At least 1 day').max(3650),
});

export type PackageTemplateInput = z.infer<typeof packageTemplateInputSchema>;

export const packageTemplateUpdateSchema = packageTemplateInputSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type PackageTemplateUpdate = z.infer<typeof packageTemplateUpdateSchema>;

export interface PackageTemplate extends PackageTemplateInput {
  id: string;
  serviceName: string;
  isActive: boolean;
  createdAt: string;
}

/** Sell a package to a client, optionally taking a payment (full or partial) at the same time. */
export const packageSaleSchema = z.object({
  clientId: z.uuid(),
  templateId: z.uuid('Choose a package'),
  payment: paymentInputSchema.optional(),
});

export type PackageSale = z.infer<typeof packageSaleSchema>;

export type PackageStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface ClientPackage {
  id: string;
  clientId: string;
  templateId: string;
  name: string;
  serviceId: string;
  serviceName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  /** Remaining sessions that are not already taken by a booked, not-yet-done visit */
  sessionsAvailableToBook: number;
  priceUsd: number;
  paidUsd: number;
  purchasedAt: string;
  /** The first moment the package is no longer valid */
  expiresAt: string;
  /** 'expired' is worked out from the date, so it is accurate without a nightly job */
  status: PackageStatus;
}
