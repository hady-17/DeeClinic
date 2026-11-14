import { clinicSettingsInputSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getClinicSettings, saveClinicSettings } from '../repositories/clinic-settings.js';

export const clinicSettingsRouter = Router();

clinicSettingsRouter.use('/clinic-settings', requireAuth);

clinicSettingsRouter.get('/clinic-settings', async (_req, res) => {
  res.json({ data: await getClinicSettings() });
});

clinicSettingsRouter.put('/clinic-settings', requireRole('owner', 'manager'), async (req, res) => {
  const input = clinicSettingsInputSchema.parse(req.body);
  const before = await getClinicSettings();
  const after = await saveClinicSettings(input);
  await writeAudit({
    actorId: req.user!.id,
    action: 'clinic_settings.update',
    entity: 'clinic_settings',
    before,
    after,
  });
  res.json({ data: after });
});
