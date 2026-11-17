import { env } from './config/env.js';
import { sequelize } from './db/models/index.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
});

const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutdown signal received, closing server');
  server.close(async () => {
    try {
      await sequelize.close();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error closing database connection');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
