import { Router } from 'express';
import { appointmentsRouter } from './appointments.js';
import { authRouter } from './auth.js';
import { clientImportRouter } from './client-import.js';
import { clientsRouter } from './clients.js';
import { clinicSettingsRouter } from './clinic-settings.js';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';
import { servicesRouter } from './services.js';
import { usersRouter } from './users.js';
import { visitNotesRouter } from './visit-notes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(meRouter);
apiRouter.use(usersRouter);
apiRouter.use(clinicSettingsRouter);
apiRouter.use(servicesRouter);
// Before clientsRouter, so /clients/import is never read as /clients/:id
apiRouter.use(clientImportRouter);
apiRouter.use(clientsRouter);
apiRouter.use(appointmentsRouter);
apiRouter.use(visitNotesRouter);
