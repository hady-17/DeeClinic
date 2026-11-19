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
  markNoShow,
  patchAppointment,
  setStatus,
} from '../repositories/appointments.js';
import { getClientPackage } from '../repositories/client-packages.js';
import { getClient } from '../repositories/clients.js';
import { getClinicSettings } from '../repositories/clinic-settings.js';
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

/**
 * A visit can be booked against a package only if the package belongs to this client, covers
 * this service, is still valid on the visit date, and has a session not already promised to
 * another booked visit.
 */
async function assertPackageUsable(
  packageId: string,
  visit: { clientId: string; serviceId: string; startAt: string },
  ownBookingCounted = false,
) {
  const pkg = await getClientPackage(packageId);
  if (!pkg || pkg.clientId !== visit.clientId) throw AppError.notFound('Package not found for this client.');
  if (pkg.serviceId !== visit.serviceId) {
    throw AppError.businessRule(`This package is for ${pkg.serviceName}, not the service chosen.`);
  }
  if (pkg.status !== 'active') {
    throw AppError.businessRule(`This package is ${pkg.status}, so it cannot be used for a booking.`);
  }
  if (new Date(visit.startAt) >= new Date(pkg.expiresAt)) {
    throw AppError.businessRule('This package expires before the chosen date.');
  }
  // A booking being moved already holds one of the sessions, so it does not need a second one.
  const available = pkg.sessionsAvailableToBook + (ownBookingCounted ? 1 : 0);
  if (available <= 0) {
    throw AppError.businessRule('All remaining sessions of this package are already booked.');
  }
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

    // Booked against a package: the package pays for the visit, so its own price is 0
    let priceUsd = service.priceUsd;
    if (input.clientPackageId) {
      await assertPackageUsable(input.clientPackageId, {
        clientId: client.id,
        serviceId: service.id,
        startAt,
      });
      priceUsd = 0;
    }

    const created = await insertAppointment({
      clientId: client.id,
      serviceId: service.id,
      clientPackageId: input.clientPackageId ?? null,
      startAt,
      endAt: endFrom(startAt, service.durationMinutes),
      priceUsd,
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

  if (before.clientPackageId) {
    // A package visit stays on its package's service, and must still fall inside its validity
    if (serviceChanged) {
      throw AppError.businessRule('A visit booked on a package keeps the package\'s service.');
    }
    await assertPackageUsable(
      before.clientPackageId,
      { clientId: before.clientId, serviceId: before.serviceId, startAt },
      true,
    );
  }
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

/**
 * A no-show frees the slot. Whether it also uses up a package session follows the clinic
 * setting, which the owner can change. The response says if a session was used.
 */
appointmentsRouter.post('/appointments/:id/no-show', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const before = await loadOpen(id);
  const settings = await getClinicSettings();
  const consumed = await markNoShow(id, Boolean(settings?.noShowUsesSession));
  const after = await getAppointment(id);
  await writeAudit({
    actorId: req.user!.id,
    action: 'appointment.no_show',
    entity: 'appointments',
    entityId: id,
    before,
    after,
    ...(consumed && { after: { ...after, packageSessionUsed: true } }),
  });
  res.json({ data: after, sessionConsumed: consumed });
});

// Cancelling never uses a package session. The visit simply goes back to being available.
appointmentsRouter.post('/appointments/:id/cancel', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const before = await loadOpen(id);
  const after = await setStatus(id, [...OPEN_STATUSES], 'cancelled');
  if (!after) throw AppError.businessRule('This appointment can no longer be changed.');
  await writeAudit({
    actorId: req.user!.id,
    action: 'appointment.cancel',
    entity: 'appointments',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});
