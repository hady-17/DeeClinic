import { packageTemplateInputSchema, packageTemplateUpdateSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../repositories/package-templates.js';
import { getService } from '../repositories/services.js';

export const packageTemplatesRouter = Router();

const idSchema = z.uuid();

packageTemplatesRouter.use('/package-templates', requireAuth);

packageTemplatesRouter.get('/package-templates', requirePermission('packages.read'), async (req, res) => {
  const includeInactive = z.stringbool().optional().parse(req.query.includeInactive) ?? false;
  res.json({ data: await listTemplates(includeInactive) });
});

packageTemplatesRouter.post('/package-templates', requirePermission('packages.manage'), async (req, res) => {
  const input = packageTemplateInputSchema.parse(req.body);
  if (!(await getService(input.serviceId))) throw AppError.notFound('Service not found.');
  const created = await createTemplate(input);
  await writeAudit({
    actorId: req.user!.id,
    action: 'package_template.create',
    entity: 'package_templates',
    entityId: created.id,
    after: created,
  });
  res.status(201).json({ data: created });
});

// Packages already sold keep the terms they were sold with, so editing a template
// only changes what is offered from now on.
packageTemplatesRouter.patch('/package-templates/:id', requirePermission('packages.manage'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = packageTemplateUpdateSchema.parse(req.body);
  const before = await getTemplate(id);
  if (!before) throw AppError.notFound('Package not found.');
  if (patch.serviceId && !(await getService(patch.serviceId))) throw AppError.notFound('Service not found.');
  const after = await updateTemplate(id, patch);
  if (!after) throw AppError.notFound('Package not found.');
  const isToggle = patch.isActive !== undefined && Object.keys(patch).length === 1;
  await writeAudit({
    actorId: req.user!.id,
    action: isToggle
      ? patch.isActive
        ? 'package_template.activate'
        : 'package_template.deactivate'
      : 'package_template.update',
    entity: 'package_templates',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});
