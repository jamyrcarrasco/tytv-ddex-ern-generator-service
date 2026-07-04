import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    sslCa?: string;
  };
  apiKeys: string[];
  s3: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    ingestBucket: string;
    ingestBasePath: string;
    distributorName: string;
    connectionTimeout: number;
    requestTimeout: number;
    maxAttempts: number;
  };
}

/**
 * Validates and parses environment variables
 */
function loadConfig(): Config {
  const requiredEnvVars = [
    'PORT',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'API_KEYS',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'S3_INGEST_BUCKET',
    'S3_INGEST_BASE_PATH',
    'AUDIOSALAD_DISTRIBUTOR_NAME',
  ];

  // Check for missing required environment variables
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please create a .env file based on example.env'
    );
  }

  // Parse PORT (puerto del servidor Express)
  const port = parseInt(process.env.PORT as string, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
  }

  // Parse DB_PORT (opcional — default 3306 para MySQL local/dev).
  // NO reutilizar `port` aquí: ese es el puerto del servidor Express, no el de la DB.
  const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
  if (isNaN(dbPort) || dbPort <= 0 || dbPort > 65535) {
    throw new Error('DB_PORT must be a valid number between 1 and 65535');
  }

  // Parse API_KEYS (comma-separated)
  const apiKeys = (process.env.API_KEYS as string)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (apiKeys.length === 0) {
    throw new Error('API_KEYS must contain at least one valid API key');
  }

  return {
    port,
    db: {
      host: process.env.DB_HOST as string,
      port: dbPort,
      user: process.env.DB_USER as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_NAME as string,
      // Opcional: solo presente en producción (DigitalOcean managed DB requiere SSL)
      sslCa: process.env.DB_SSL_CA || undefined,
    },
    apiKeys,
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      region: process.env.AWS_REGION as string,
      ingestBucket: process.env.S3_INGEST_BUCKET as string,
      ingestBasePath: process.env.S3_INGEST_BASE_PATH as string,
      distributorName: process.env.AUDIOSALAD_DISTRIBUTOR_NAME as string,
      connectionTimeout: parseInt(process.env.S3_CONNECTION_TIMEOUT || '5000', 10),
      requestTimeout: parseInt(process.env.S3_REQUEST_TIMEOUT || '120000', 10),
      maxAttempts: parseInt(process.env.S3_MAX_ATTEMPTS || '3', 10),
    },
  };
}

export const config = loadConfig();