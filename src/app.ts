import express, { Application, Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import ddexRoutes from './routes/ddexRoutes';
import logger from './config/logger';
import { pingDb } from './config/db';

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, path: req.path }, 'incoming request');
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'tytv-ddex-ern-generator-service',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ddex/health', async (_req: Request, res: Response): Promise<void> => {
    const dbOk = await pingDb();
    const status = dbOk ? 200 : 503;
    res.status(status).json({
      status: dbOk ? 'ok' : 'degraded',
      service: 'tytv-ddex-ern-generator-service',
      version: '1.0.0',
      checks: { db: dbOk ? 'ok' : 'unreachable' },
    });
  });

  app.use('/api/ddex', apiKeyAuth, ddexRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}
