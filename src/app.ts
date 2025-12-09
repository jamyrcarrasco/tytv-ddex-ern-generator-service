import express, { Application, Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import ddexRoutes from './routes/ddexRoutes';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // =============================================
  // MIDDLEWARE
  // =============================================

  // Parse JSON request bodies
  app.use(express.json());

  // Parse URL-encoded request bodies
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // =============================================
  // ROUTES
  // =============================================

  // Health check route (no API key required)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'tytv-ddex-ern-generator-service',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes with authentication
  app.use('/api/ddex', apiKeyAuth, ddexRoutes);

  // =============================================
  // ERROR HANDLERS
  // =============================================

  // 404 handler - route not found
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}

