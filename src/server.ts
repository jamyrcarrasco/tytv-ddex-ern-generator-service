import { createApp } from './app';
import { config } from './config/env';
import { testConnection, closePool } from './config/db';
import logger from './config/logger';

async function startServer() {
  try {
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: process.env.NODE_ENV || 'development' },
        'DDEX ERN Generator Service started'
      );
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Graceful shutdown started');

      server.close(async () => {
        logger.info('HTTP server closed');
        await closePool();
        logger.info('Shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
