import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const meRouter = Router();

meRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});
