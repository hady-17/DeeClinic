import { z } from 'zod';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that can still be changed, rescheduled, completed or cancelled. */
export const OPEN_STATUSES: readonly AppointmentStatus[] = ['scheduled', 'confirmed'];

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** ISO 8601 with an offset, for example 2026-11-14T10:00:00+02:00 or ...Z. */
const instant = z.iso.datetime({ offset: true });

export const appointmentCreateSchema = z.object({
  clientId: z.uuid(),
  serviceId: z.uuid(),
  startAt: instant,
  notes: z.preprocess(blankToNull, z.string().trim().max(1000).nullable()).default(null),
  /** Book this visit against one of the client's packages. The price is then 0. */
  clientPackageId: z.uuid().nullable().optional(),
});

export type AppointmentCreate = z.infer<typeof appointmentCreateSchema>;

/** Reschedule or edit. The end time is always recalculated from the service duration. */
export const appointmentUpdateSchema = z
  .object({
    serviceId: z.uuid(),
    startAt: instant,
    notes: z.preprocess(blankToNull, z.string().trim().max(1000).nullable()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type AppointmentUpdate = z.infer<typeof appointmentUpdateSchema>;

export const appointmentRangeSchema = z
  .object({ from: instant, to: instant })
  .refine((r) => new Date(r.to) > new Date(r.from), 'to must be after from')
  .refine(
    (r) => new Date(r.to).getTime() - new Date(r.from).getTime() <= 62 * 24 * 3600 * 1000,
    'Range is limited to 62 days',
  );

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  clientPackageId: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  priceUsd: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
