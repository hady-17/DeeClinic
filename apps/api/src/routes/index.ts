import { Router } from 'express';
import { appointmentsRouter } from './appointments.js';
import { authRouter } from './auth.js';
import { clientImportRouter } from './client-import.js';
import { clientPackagesRouter } from './client-packages.js';
import { clientsRouter } from './clients.js';
import { clinicSettingsRouter } from './clinic-settings.js';
import { exchangeRatesRouter } from './exchange-rates.js';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';
import { packageTemplatesRouter } from './package-templates.js';
import { paymentsRouter } from './payments.js';
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
apiRouter.use(clientPackagesRouter);
apiRouter.use(clientsRouter);
apiRouter.use(appointmentsRouter);
apiRouter.use(visitNotesRouter);
apiRouter.use(exchangeRatesRouter);
apiRouter.use(packageTemplatesRouter);
apiRouter.use(paymentsRouter);
