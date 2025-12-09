import { createApp } from './app';
import { config } from './config/env';
import { testConnection, closePool } from './config/db';

/**
 * Start the server
 */
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Create Express app
    const app = createApp();

    // Start listening
    const server = app.listen(config.port, () => {
      console.log('===========================================');
      console.log('  DDEX ERN Generator Service');
      console.log('===========================================');
      console.log(`  Status: Running`);
      console.log(`  Port: ${config.port}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Time: ${new Date().toISOString()}`);
      console.log('===========================================');
      console.log(`  Endpoints:`);
      console.log(`    GET  http://localhost:${config.port}/health`);
      console.log(`    POST http://localhost:${config.port}/api/ddex/generate`);
      console.log('===========================================');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('HTTP server closed');
        await closePool();
        console.log('Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

