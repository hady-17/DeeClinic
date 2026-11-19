import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { parseOrigins } from './config/origins.js';
import { logger } from './lib/logger.js';
import { rateLimit } from './lib/rate-limit.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel's proxy, so req.ip is the real client address (needed for rate limiting)
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id']?.toString() ?? randomUUID(),
      // Log route, status and duration only. No bodies, no query strings.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: parseOrigins(process.env.WEB_ORIGIN) }));
  // The raw body for the WhatsApp webhook signature is added with that route in Phase 3.
  // CSV imports are bigger than a normal request, so only that path gets a higher limit.
  app.use('/api/v1/clients/import', express.json({ limit: '3mb' }));
  app.use(express.json({ limit: '1mb' }));

  // A general ceiling per client address. Health checks are exempt so uptime monitors work.
  const general = rateLimit({ name: 'general', limit: 300, windowSeconds: 60, failOpen: true });
  app.use('/api/v1', (req, res, next) => (req.path === '/health' ? next() : general(req, res, next)));
  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
