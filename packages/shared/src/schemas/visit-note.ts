import { z } from 'zod';
import type { Appointment } from './appointment';

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const visitNoteCreateSchema = z.object({
  appointmentId: z.uuid(),
  body: z.string().trim().min(1, 'Write a note first').max(5000),
  productsUsed: z.preprocess(blankToNull, z.string().trim().max(500).nullable()).default(null),
});

export type VisitNoteCreate = z.infer<typeof visitNoteCreateSchema>;

export const visitNoteUpdateSchema = z
  .object({
    body: z.string().trim().min(1, 'Write a note first').max(5000),
    productsUsed: z.preprocess(blankToNull, z.string().trim().max(500).nullable()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type VisitNoteUpdate = z.infer<typeof visitNoteUpdateSchema>;

export interface VisitNote {
  id: string;
  clientId: string;
  appointmentId: string | null;
  body: string;
  productsUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One visit in a client's history, with its notes. */
export interface ClientHistoryEntry extends Appointment {
  visitNotes: VisitNote[];
}
