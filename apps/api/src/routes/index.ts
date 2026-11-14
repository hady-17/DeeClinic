import { Router } from 'express';
import { appointmentsRouter } from './appointments.js';
import { clientsRouter } from './clients.js';
import { clinicSettingsRouter } from './clinic-settings.js';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';
import { servicesRouter } from './services.js';
import { visitNotesRouter } from './visit-notes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(meRouter);
apiRouter.use(clinicSettingsRouter);
apiRouter.use(servicesRouter);
apiRouter.use(clientsRouter);
apiRouter.use(appointmentsRouter);
apiRouter.use(visitNotesRouter);
