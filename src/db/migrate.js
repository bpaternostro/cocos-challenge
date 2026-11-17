import { pathToFileURL } from 'node:url';
import Decimal from 'decimal.js';
import { sequelize } from './models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Applies idempotent schema extensions (positions table, idempotencyKey, indexes)
 * and backfills positions from existing orders if positions is empty.
 */
export async function runMigrations() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS positions (
      userid INT NOT NULL REFERENCES users(id),
      instrumentid INT NOT NULL REFERENCES instruments(id),
      qty NUMERIC(18, 2) NOT NULL DEFAULT 0,
      reservedqty NUMERIC(18, 2) NOT NULL DEFAULT 0,
      avgcost NUMERIC(18, 4) NOT NULL DEFAULT 0,
      updatedat TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (userid, instrumentid)
    );
  `);

  await sequelize.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS idempotencykey VARCHAR(36) NULL;
  `);

  await sequelize.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS idempotencyhash VARCHAR(64) NULL;
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_idempotency
    ON orders(userid, idempotencykey)
    WHERE idempotencykey IS NOT NULL;
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_status
    ON orders(userid, status);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_instruments_type_ticker
    ON instruments(type, ticker);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_marketdata_instrument_date
    ON marketdata(instrumentid, date DESC, id DESC);
  `);

  await backfillPositionsIfEmpty();
}

async function backfillPositionsIfEmpty() {
  const [[{ count }]] = await sequelize.query('SELECT COUNT(*)::int AS count FROM positions;');
  if (count > 0) return;

  const [arsRows] = await sequelize.query(
    "SELECT id FROM instruments WHERE type = 'MONEDA' ORDER BY id ASC LIMIT 1;",
  );
  if (arsRows.length === 0) return;
  const arsInstrumentId = arsRows[0].id;

  const [orders] = await sequelize.query(`
    SELECT id, userid, instrumentid, size, price, side, status
    FROM orders
    WHERE status IN ('FILLED', 'NEW')
    ORDER BY datetime ASC, id ASC;
  `);

  if (orders.length === 0) return;

  /** @type {Map<string, { userId: number, instrumentId: number, qty: Decimal, reservedQty: Decimal, avgCost: Decimal }>} */
  const posMap = new Map();

  const getPos = (userId, instrumentId) => {
    const key = `${userId}:${instrumentId}`;
    if (!posMap.has(key)) {
      posMap.set(key, {
        userId,
        instrumentId,
        qty: new Decimal(0),
        reservedQty: new Decimal(0),
        avgCost: new Decimal(0),
      });
    }
    return posMap.get(key);
  };

  for (const order of orders) {
    const size = new Decimal(order.size);
    const price = new Decimal(order.price);
    const total = size.times(price);
    const arsPos = getPos(order.userid, arsInstrumentId);
    const assetPos = getPos(order.userid, order.instrumentid);

    if (order.status === 'FILLED') {
      if (order.side === 'CASH_IN') {
        arsPos.qty = arsPos.qty.plus(size);
      } else if (order.side === 'CASH_OUT') {
        arsPos.qty = arsPos.qty.minus(size);
      } else if (order.side === 'BUY') {
        arsPos.qty = arsPos.qty.minus(total);
        const newQty = assetPos.qty.plus(size);
        if (newQty.gt(0)) {
          assetPos.avgCost = assetPos.qty.times(assetPos.avgCost).plus(total).div(newQty);
        }
        assetPos.qty = newQty;
      } else if (order.side === 'SELL') {
        arsPos.qty = arsPos.qty.plus(total);
        assetPos.qty = assetPos.qty.minus(size);
        if (assetPos.qty.lte(0)) {
          assetPos.avgCost = new Decimal(0);
        }
      }
    } else if (order.status === 'NEW') {
      if (order.side === 'BUY') {
        arsPos.reservedQty = arsPos.reservedQty.plus(total);
      } else if (order.side === 'SELL') {
        assetPos.reservedQty = assetPos.reservedQty.plus(size);
      }
    }
  }

  await sequelize.transaction(async (transaction) => {
    for (const pos of posMap.values()) {
      await sequelize.query(
        `
        INSERT INTO positions (userid, instrumentid, qty, reservedqty, avgcost, updatedat)
        VALUES (:userId, :instrumentId, :qty, :reservedQty, :avgCost, NOW())
        ON CONFLICT (userid, instrumentid) DO NOTHING;
        `,
        {
          replacements: {
            userId: pos.userId,
            instrumentId: pos.instrumentId,
            qty: pos.qty.toFixed(2),
            reservedQty: pos.reservedQty.toFixed(2),
            avgCost: pos.avgCost.toFixed(4),
          },
          transaction,
        },
      );
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => {
      logger.info('Database migrations completed successfully');
      return sequelize.close();
    })
    .catch((err) => {
      logger.error({ err }, 'Database migration failed');
      process.exit(1);
    });
}
