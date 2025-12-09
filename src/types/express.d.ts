/**
 * Express type augmentation for API key authentication
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
    }
  }
}

