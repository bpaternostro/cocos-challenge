import { QueryTypes } from 'sequelize';
import { Instrument, Order, User, sequelize } from '../../db/models/index.js';

export class OrdersRepository {
  /**
   * @param {number} userId
   */
  static async findUserById(userId) {
    return User.findByPk(userId, { raw: true });
  }

  /**
   * Lists paginated orders for a user with instrument metadata in a single query.
   * @param {{ userId: number, status?: string, side?: string, limit: number, offset: number }} params
   */
  static async findOrdersByUserId({ userId, status, side, limit, offset }) {
    const conditions = ['o.userid = :userId'];
    const replacements = { userId, limit, offset };

    if (status) {
      conditions.push('o.status = :status');
      replacements.status = status;
    }

    if (side) {
      conditions.push('o.side = :side');
      replacements.side = side;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await sequelize.query(
      `
      SELECT
        o.id,
        o.userid AS "userId",
        o.instrumentid AS "instrumentId",
        i.ticker,
        i.name AS "instrumentName",
        i.type AS "instrumentType",
        o.side,
        o.type,
        o.size,
        o.price,
        o.status,
        o.datetime,
        o.idempotencykey AS "idempotencyKey",
        COUNT(*) OVER()::int AS "totalCount"
      FROM orders o
      INNER JOIN instruments i ON i.id = o.instrumentid
      ${whereClause}
      ORDER BY o.datetime DESC, o.id DESC
      LIMIT :limit OFFSET :offset;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    const total = rows.length > 0 ? rows[0].totalCount : 0;
    return { rows, total };
  }
  /**
   * Acquires a pessimistic row lock on the user to serialize concurrent order operations.
   * @param {number} userId
   * @param {import('sequelize').Transaction} transaction
   */
  static async lockUserById(userId, transaction) {
    const rows = await sequelize.query(
      'SELECT id FROM users WHERE id = :userId FOR UPDATE;',
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    return rows[0] ?? null;
  }

  /**
   * @param {number} userId
   * @param {string} idempotencyKey
   * @param {import('sequelize').Transaction} transaction
   */
  static async findByIdempotencyKey(userId, idempotencyKey, transaction) {
    return Order.findOne({
      where: { userId, idempotencyKey },
      transaction,
    });
  }

  /**
   * @param {number} instrumentId
   * @param {import('sequelize').Transaction} transaction
   */
  static async findInstrumentById(instrumentId, transaction) {
    return Instrument.findByPk(instrumentId, { raw: true, transaction });
  }

  /**
   * @param {import('sequelize').Transaction} transaction
   */
  static async findArsInstrument(transaction) {
    return Instrument.findOne({
      where: { type: 'MONEDA' },
      order: [['id', 'ASC']],
      raw: true,
      transaction,
    });
  }

  /**
   * @param {number} instrumentId
   * @param {import('sequelize').Transaction} transaction
   */
  static async findLatestMarketPrice(instrumentId, transaction) {
    const rows = await sequelize.query(
      `
      SELECT close
      FROM marketdata
      WHERE instrumentid = :instrumentId
      ORDER BY date DESC, id DESC
      LIMIT 1;
      `,
      {
        replacements: { instrumentId },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    return rows[0]?.close ?? null;
  }

  /**
   * Ensures a position row exists and locks it for update.
   * @param {number} userId
   * @param {number} instrumentId
   * @param {import('sequelize').Transaction} transaction
   */
  static async lockOrCreatePosition(userId, instrumentId, transaction) {
    await sequelize.query(
      `
      INSERT INTO positions (userid, instrumentid, qty, reservedqty, avgcost, updatedat)
      VALUES (:userId, :instrumentId, 0, 0, 0, NOW())
      ON CONFLICT (userid, instrumentid) DO NOTHING;
      `,
      {
        replacements: { userId, instrumentId },
        transaction,
      },
    );

    const rows = await sequelize.query(
      `
      SELECT
        userid AS "userId",
        instrumentid AS "instrumentId",
        qty,
        reservedqty AS "reservedQty",
        avgcost AS "avgCost"
      FROM positions
      WHERE userid = :userId AND instrumentid = :instrumentId
      FOR UPDATE;
      `,
      {
        replacements: { userId, instrumentId },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    return rows[0];
  }

  /**
   * @param {{ userId: number, instrumentId: number, qty: string, reservedQty: string, avgCost: string }} pos
   * @param {import('sequelize').Transaction} transaction
   */
  static async updatePosition(pos, transaction) {
    await sequelize.query(
      `
      UPDATE positions
      SET qty = :qty, reservedqty = :reservedQty, avgcost = :avgCost, updatedat = NOW()
      WHERE userid = :userId AND instrumentid = :instrumentId;
      `,
      {
        replacements: pos,
        transaction,
      },
    );
  }

  /**
   * @param {object} data
   * @param {import('sequelize').Transaction} transaction
   */
  static async createOrder(data, transaction) {
    return Order.create(data, { transaction });
  }

  /**
   * @param {number} orderId
   * @param {import('sequelize').Transaction} [transaction]
   */
  static async findOrderById(orderId, transaction) {
    return Order.findByPk(orderId, { transaction });
  }
}
