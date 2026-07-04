import fs from 'fs';
import mysql from 'mysql2/promise';
import { config } from './env';
import logger from './logger';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Solo se activa si DB_SSL_CA está presente (producción). En local/dev queda undefined.
  ssl: config.db.sslCa
    ? { ca: fs.readFileSync(config.db.sslCa) }
    : undefined,
});

export async function pingDb(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return true;
  } catch {
    return false;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database connection failed');
    return false;
  }
}

export async function closePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error({ err: error }, 'Error closing database pool');
  }
}