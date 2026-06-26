import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  port: number;
  db: {
    host: string;
    user: string;
    password: string;
    database: string;
  };
  apiKeys: string[];
  s3: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    ingestBucket: string;
    ingestBasePath: string;
    distributorName: string;
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

  // Parse PORT
  const port = parseInt(process.env.PORT as string, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535');
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
      user: process.env.DB_USER as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_NAME as string,
    },
    apiKeys,
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      region: process.env.AWS_REGION as string,
      ingestBucket: process.env.S3_INGEST_BUCKET as string,
      ingestBasePath: process.env.S3_INGEST_BASE_PATH as string,
      distributorName: process.env.AUDIOSALAD_DISTRIBUTOR_NAME as string,
    },
  };
}

export const config = loadConfig();

