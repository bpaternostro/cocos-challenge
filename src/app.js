import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { sequelize } from './db/models/index.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/AppError.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { portfolioRouter } from './modules/portfolio/portfolio.routes.js';
import { assetsRouter } from './modules/assets/assets.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );

  if (env.NODE_ENV !== 'test') {
    app.use(
      rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
      }),
    );
  }

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
      }),
    );
  }

  app.get('/health', async (_req, res, next) => {
    try {
      await sequelize.authenticate();
      res.status(200).json({ status: 'ok', db: 'connected' });
    } catch (err) {
      next(new AppError(503, 'Database unavailable', err.message));
    }
  });

  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/assets', assetsRouter);
  app.use('/api/orders', ordersRouter);

  app.use((_req, _res, next) => {
    next(new AppError(404, 'Route not found'));
  });

  app.use(errorHandler);

  return app;
};
