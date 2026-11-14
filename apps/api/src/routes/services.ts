import { serviceInputSchema, serviceUpdateSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createService,
  getService,
  listServices,
  updateService,
} from '../repositories/services.js';

export const servicesRouter = Router();

const canEdit = requireRole('owner', 'manager');
const idSchema = z.uuid();

servicesRouter.use('/services', requireAuth);

servicesRouter.get('/services', async (req, res) => {
  const includeInactive = z.stringbool().optional().parse(req.query.includeInactive) ?? false;
  res.json({ data: await listServices(includeInactive) });
});

servicesRouter.post('/services', canEdit, async (req, res) => {
  const input = serviceInputSchema.parse(req.body);
  const created = await createService(input);
  await writeAudit({
    actorId: req.user!.id,
    action: 'service.create',
    entity: 'services',
    entityId: created.id,
    after: created,
  });
  res.status(201).json({ data: created });
});

servicesRouter.patch('/services/:id', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = serviceUpdateSchema.parse(req.body);
  const before = await getService(id);
  if (!before) throw AppError.notFound('Service not found.');
  const after = await updateService(id, patch);
  if (!after) throw AppError.notFound('Service not found.');
  const isToggle = patch.isActive !== undefined && Object.keys(patch).length === 1;
  await writeAudit({
    actorId: req.user!.id,
    action: isToggle ? (patch.isActive ? 'service.activate' : 'service.deactivate') : 'service.update',
    entity: 'services',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});
