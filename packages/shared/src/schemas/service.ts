import { z } from 'zod';

export const SERVICE_CATEGORIES = [
  'skin_care',
  'laser_injectables',
  'hair_nails',
  'waxing_body',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  skin_care: 'Skin care',
  laser_injectables: 'Laser and injectables',
  hair_nails: 'Hair and nails',
  waxing_body: 'Waxing and body',
};

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(SERVICE_CATEGORIES),
  durationMinutes: z
    .number()
    .int('Whole minutes only')
    .min(5, 'At least 5 minutes')
    .max(480, 'At most 480 minutes'),
  priceUsd: z.number().min(0, 'Price cannot be negative').max(100000),
  followUpIntervalDays: z
    .number()
    .int('Whole days only')
    .min(1, 'At least 1 day')
    .max(3650)
    .nullable(),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceUpdateSchema = serviceInputSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;

export interface Service extends ServiceInput {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
