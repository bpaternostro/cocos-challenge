import { QueryTypes } from 'sequelize';
import { sequelize, User } from '../../db/models/index.js';

export class PortfolioRepository {
  /**
   * @param {number} userId
   */
  static async findUserById(userId) {
    return User.findByPk(userId, { raw: true });
  }

  /**
   * Fetches user positions joined with instrument metadata and latest market close price in a single query.
   * @param {number} userId
   */
  static async findPositionsWithLatestMarketData(userId) {
    return sequelize.query(
      `
      SELECT
        p.instrumentid AS "instrumentId",
        i.ticker,
        i.name,
        i.type,
        p.qty,
        p.reservedqty AS "reservedQty",
        p.avgcost AS "avgCost",
        md.close AS "marketClose"
      FROM positions p
      INNER JOIN instruments i ON i.id = p.instrumentid
      LEFT JOIN LATERAL (
        SELECT m.close
        FROM marketdata m
        WHERE m.instrumentid = p.instrumentid
        ORDER BY m.date DESC, m.id DESC
        LIMIT 1
      ) md ON TRUE
      WHERE p.userid = :userId
        AND (p.qty > 0 OR i.type = 'MONEDA')
      ORDER BY i.ticker ASC;
      `,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
  }
}
