import { clientInputSchema, clientUpdateSchema } from '@deeclinic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listClientHistory } from '../repositories/appointments.js';
import { createClient, getClient, listClients, updateClient } from '../repositories/clients.js';

export const clientsRouter = Router();

const canEdit = requireRole('owner', 'manager', 'staff');
const idSchema = z.uuid();
const listQuerySchema = z.object({
  q: z.string().max(100).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

clientsRouter.use('/clients', requireAuth);

clientsRouter.get('/clients', async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  res.json(await listClients(query));
});

clientsRouter.get('/clients/:id', async (req, res) => {
  const client = await getClient(idSchema.parse(req.params.id));
  if (!client) throw AppError.notFound('Client not found.');
  res.json({ data: client });
});

clientsRouter.get('/clients/:id/history', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  if (!(await getClient(id))) throw AppError.notFound('Client not found.');
  // Visits and notes now; payments and messages join this response in later phases.
  res.json({ data: { visits: await listClientHistory(id, 200) } });
});

clientsRouter.post('/clients', canEdit, async (req, res) => {
  const input = clientInputSchema.parse(req.body);
  const created = await createClient(input);
  await writeAudit({
    actorId: req.user!.id,
    action: 'client.create',
    entity: 'clients',
    entityId: created.id,
    after: created,
  });
  res.status(201).json({ data: created });
});

clientsRouter.patch('/clients/:id', canEdit, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const patch = clientUpdateSchema.parse(req.body);
  const before = await getClient(id);
  if (!before) throw AppError.notFound('Client not found.');
  const after = await updateClient(id, patch, before);
  if (!after) throw AppError.notFound('Client not found.');
  await writeAudit({
    actorId: req.user!.id,
    action: 'client.update',
    entity: 'clients',
    entityId: id,
    before,
    after,
  });
  res.json({ data: after });
});
