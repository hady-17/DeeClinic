import { permissionsFor, type Me } from '@deeclinic/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, (req, res) => {
  const { id, email, fullName, role } = req.user!;
  const me: Me = { id, email, fullName, role, permissions: permissionsFor(role) };
  res.json({ data: me });
});
