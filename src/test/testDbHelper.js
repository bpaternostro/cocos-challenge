import { env } from '../config/env.js';
import { sequelize } from '../db/models/index.js';
import { runMigrations } from '../db/migrate.js';

/**
 * Prepares schema and seeds deterministic test data for functional tests.
 */
export async function setupTestDatabase() {
  if (!env.TEST_DATABASE_URL || env.TEST_DATABASE_URL === env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL must be set and different from DATABASE_URL before running destructive functional tests',
    );
  }
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255),
      accountNumber VARCHAR(20)
    );
    CREATE TABLE IF NOT EXISTS instruments (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(10),
      name VARCHAR(255),
      type VARCHAR(10)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      instrumentId INT REFERENCES instruments(id),
      userId INT REFERENCES users(id),
      size INT,
      price NUMERIC(10, 2),
      type VARCHAR(10),
      side VARCHAR(10),
      status VARCHAR(20),
      datetime TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS marketdata (
      id SERIAL PRIMARY KEY,
      instrumentId INT REFERENCES instruments(id),
      high NUMERIC(10, 2),
      low NUMERIC(10, 2),
      open NUMERIC(10, 2),
      close NUMERIC(10, 2),
      previousClose NUMERIC(10, 2),
      date DATE
    );
  `);

  await runMigrations();
  await resetTestData();
}

export async function resetTestData() {
  await sequelize.query('TRUNCATE TABLE positions, orders, marketdata, instruments, users RESTART IDENTITY CASCADE;');

  await sequelize.query(`
    INSERT INTO users (id, email, accountNumber) VALUES
      (1, 'test1@cocos.com', '10001'),
      (2, 'test2@cocos.com', '10002');
    SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

    INSERT INTO instruments (id, ticker, name, type) VALUES
      (1, 'ARS', 'Pesos', 'MONEDA'),
      (2, 'PAMP', 'Pampa Energía S.A.', 'ACCIONES'),
      (3, 'GGAL', 'Grupo Financiero Galicia', 'ACCIONES'),
      (4, 'YPFD', 'YPF S.A.', 'ACCIONES');
    SELECT setval('instruments_id_seq', (SELECT MAX(id) FROM instruments));

    INSERT INTO marketdata (instrumentId, high, low, open, close, previousClose, date) VALUES
      (2, 1050.00, 950.00, 980.00, 1000.00, 950.00, '2025-01-10'),
      (3, 520.00, 480.00, 490.00, 500.00, 500.00, '2025-01-10');
  `);
}

export async function teardownTestDatabase() {
  await sequelize.close();
}
