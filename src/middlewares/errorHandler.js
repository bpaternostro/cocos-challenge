import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Global Express error handling middleware.
 * @type {import('express').ErrorRequestHandler}
 */
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        requestId: req.id,
      },
    });
  }

  // Handle malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        message: 'Invalid JSON payload',
        requestId: req.id,
      },
    });
  }

  logger.error({ err, requestId: req.id }, 'Unhandled application error');

  return res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
      requestId: req.id,
    },
  });
};
