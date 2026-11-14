import { visitNoteCreateSchema, visitNoteUpdateSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAppointment } from '../repositories/appointments.js';
import { createNote, getNote, listNotes, updateNote } from '../repositories/visit-notes.js';

export const visitNotesRouter = Router();

const canEdit = requireRole('owner', 'manager', 'staff');
const idSchema = z.uuid();

visitNotesRouter.use('/visit-notes', requireAuth);

visitNotesRouter.get('/visit-notes', async (req, res) => {
  const appointmentId = idSchema.parse(req.query.appointmentId);
  res.json({ data: await listNotes(appointmentId) });
});

visitNotesRouter.post('/visit-notes', canEdit, async (req, res) => {
  const input = visitNoteCreateSchema.parse(req.body);
  const appointment = await getAppointment(input.appointmentId);
  if (!appointment) throw AppError.notFound('Appointment not found.');
  if (appointment.status === 'cancelled') {
    throw AppError.businessRule('Notes cannot be added to a cancelled appointment.');
  }
  const created = await createNote({
    clientId: appointment.clientId,
    appointmentId: appointment.id,
    body: input.body,
    productsUsed: input.productsUsed,
    createdBy: req.user!.id,
  });
  // The audit log records that a note changed, not what it said.
  await writeAudit({
    actorId: req.user!.id,
    action: 'visit_note.create',
    entity: 'visit_notes',
    entityId: created.id,
    after: { id: created.id, appointmentId: created.appointmentId, clientId: created.clientId },
  });
  res.status(201).json({ data: created });
});

visitNotesRouter.patch('/visit-notes/:id', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = visitNoteUpdateSchema.parse(req.body);
  const before = await getNote(id);
  if (!before) throw AppError.notFound('Note not found.');
  const after = await updateNote(id, patch);
  if (!after) throw AppError.notFound('Note not found.');
  await writeAudit({
    actorId: req.user!.id,
    action: 'visit_note.update',
    entity: 'visit_notes',
    entityId: id,
    after: { id, changed: Object.keys(patch) },
  });
  res.json({ data: after });
});
