import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';

const env = getEnv();
createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});
