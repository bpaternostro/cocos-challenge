import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const requiresSsl = env.activeDatabaseUrl.includes('sslmode=require') || env.activeDatabaseUrl.includes('neon.tech');

export const sequelize = new Sequelize(env.activeDatabaseUrl, {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? (msg) => logger.debug({ sql: msg }, 'sequelize') : false,
  dialectOptions: requiresSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});
