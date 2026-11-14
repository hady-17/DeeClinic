import {
  OPEN_STATUSES,
  appointmentCreateSchema,
  appointmentRangeSchema,
  appointmentUpdateSchema,
  type Appointment,
} from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  completeAppointment,
  getAppointment,
  insertAppointment,
  listAppointments,
  patchAppointment,
  setStatus,
} from '../repositories/appointments.js';
import { getClient } from '../repositories/clients.js';
import { getService } from '../repositories/services.js';

export const appointmentsRouter = Router();

const canRead = requirePermission('appointments.read');
const canEdit = requirePermission('appointments.write');
const idSchema = z.uuid();

appointmentsRouter.use('/appointments', requireAuth);

const endFrom = (startAt: string, minutes: number) =>
  new Date(new Date(startAt).getTime() + minutes * 60_000).toISOString();

async function loadOpen(id: string): Promise<Appointment> {
  const appt = await getAppointment(id);
  if (!appt) throw AppError.notFound('Appointment not found.');
  if (!OPEN_STATUSES.includes(appt.status)) {
    throw AppError.businessRule(`This appointment is already ${appt.status.replace('_', ' ')}.`);
  }
  return appt;
}

appointmentsRouter.get('/appointments', canRead, async (req, res) => {
  const { from, to } = appointmentRangeSchema.parse(req.query);
  res.json({ data: await listAppointments(from, to) });
});

appointmentsRouter.get('/appointments/:id', canRead, async (req, res) => {
  const appt = await getAppointment(idSchema.parse(req.params.id));
  if (!appt) throw AppError.notFound('Appointment not found.');
  res.json({ data: appt });
});

appointmentsRouter.post('/appointments', canEdit, async (req, res) => {
  const input = appointmentCreateSchema.parse(req.body);
  await withIdempotency(req, res, async () => {
    const [client, service] = await Promise.all([
      getClient(input.clientId),
      getService(input.serviceId),
    ]);
    if (!client) throw AppError.notFound('Client not found.');
    if (!service) throw AppError.notFound('Service not found.');
    if (!service.isActive) throw AppError.businessRule('This service is no longer offered.');

    const startAt = new Date(input.startAt).toISOString();
    const created = await insertAppointment({
      clientId: client.id,
      serviceId: service.id,
      startAt,
      endAt: endFrom(startAt, service.durationMinutes),
      priceUsd: service.priceUsd,
      notes: input.notes,
      createdBy: req.user!.id,
    });
    await writeAudit({
      actorId: req.user!.id,
      action: 'appointment.create',
      entity: 'appointments',
      entityId: created.id,
      after: created,
    });
    return { status: 201, body: { data: created } };
  });
});

appointmentsRouter.patch('/appointments/:id', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = appointmentUpdateSchema.parse(req.body);
  const before = await loadOpen(id);

  const serviceChanged = patch.serviceId !== undefined && patch.serviceId !== before.serviceId;
  const service = serviceChanged ? await getService(patch.serviceId!) : null;
  if (serviceChanged && !service) throw AppError.notFound('Service not found.');
  if (service && !service.isActive) throw AppError.businessRule('This service is no longer offered.');

  const startAt = patch.startAt ? new Date(patch.startAt).toISOString() : before.startAt;
  // Keep the booked length unless the service changed
  const minutes = service
    ? service.durationMinutes
    : (new Date(before.endAt).getTime() - new Date(before.startAt).getTime()) / 60_000;
  const endAt = endFrom(startAt, minutes);

  const after = await patchAppointment(
    id,
    {
      ...(service && { serviceId: service.id, priceUsd: service.priceUsd }),
      startAt,
      endAt,
      ...(patch.notes !== undefined && { notes: patch.notes }),
    },
    { startAt, endAt },
  );
  if (!after) throw AppError.notFound('Appointment not found.');
  await writeAudit({
    actorId: req.user!.id,
    action: patch.startAt ? 'appointment.reschedule' : 'appointment.update',
    entity: 'appointments',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});

appointmentsRouter.post('/appointments/:id/complete', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const before = await loadOpen(id);
  await completeAppointment(id);
  const after = await getAppointment(id);
  await writeAudit({
    actorId: req.user!.id,
    action: 'appointment.complete',
    entity: 'appointments',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});

for (const [path, status, action] of [
  ['no-show', 'no_show', 'appointment.no_show'],
  ['cancel', 'cancelled', 'appointment.cancel'],
] as const) {
  appointmentsRouter.post(`/appointments/:id/${path}`, canEdit, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const before = await loadOpen(id);
    const after = await setStatus(id, [...OPEN_STATUSES], status);
    if (!after) throw AppError.businessRule('This appointment can no longer be changed.');
    await writeAudit({
      actorId: req.user!.id,
      action,
      entity: 'appointments',
      entityId: id,
      before,
      after,
    });
    res.json({ data: after });
  });
}
