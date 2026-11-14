import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  // Never log personal data or credentials.
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-hub-signature-256"]'],
});
