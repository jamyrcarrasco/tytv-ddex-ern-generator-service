import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Middleware to authenticate requests using API Key
 * Expects the API key to be provided in the 'x-api-key' header
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');

  // Check if API key is provided
  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Please provide a valid API key in the x-api-key header.',
    });
    return;
  }

  // Validate API key against configured keys
  if (!config.apiKeys.includes(apiKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
    return;
  }

  // Attach validated API key to request for potential logging/auditing
  req.apiKey = apiKey;

  // Proceed to next middleware/route handler
  next();
}

