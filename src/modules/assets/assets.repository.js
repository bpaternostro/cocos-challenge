import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/models/index.js';

const escapeLikePattern = (value) => value.replace(/[\\%_]/g, '\\$&');

export class AssetsRepository {
  /**
   * Searches instruments with optional text query, multi-term queries, exact tickers list, and type filter.
   * @param {{ query?: string, queries?: string[], tickers?: string[], type?: string, limit: number, offset: number }} params
   */
  static async searchAssets({ query, queries, tickers, type, limit, offset }) {
    const conditions = [];
    const replacements = { limit, offset };

    if (query) {
      conditions.push('(i.ticker ILIKE :searchPattern OR i.name ILIKE :searchPattern)');
      replacements.searchPattern = `%${escapeLikePattern(query)}%`;
    }

    if (queries && queries.length > 0) {
      conditions.push('(i.ticker ILIKE ANY(ARRAY[:queryPatterns]) OR i.name ILIKE ANY(ARRAY[:queryPatterns]))');
      replacements.queryPatterns = queries.map((q) => `%${escapeLikePattern(q)}%`);
    }

    if (tickers && tickers.length > 0) {
      conditions.push('UPPER(i.ticker) = ANY(ARRAY[:upperTickers])');
      replacements.upperTickers = tickers.map((t) => t.toUpperCase());
    }

    if (type) {
      conditions.push('UPPER(i.type) = UPPER(:type)');
      replacements.type = type;
    } else {
      conditions.push("i.type <> 'MONEDA'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await sequelize.query(
      `
      SELECT
        i.id,
        i.ticker,
        i.name,
        i.type,
        md.close,
        md.previousclose AS "previousClose",
        COUNT(*) OVER()::int AS "totalCount"
      FROM instruments i
      LEFT JOIN LATERAL (
        SELECT m.close, m.previousclose
        FROM marketdata m
        WHERE m.instrumentid = i.id
        ORDER BY m.date DESC, m.id DESC
        LIMIT 1
      ) md ON TRUE
      ${whereClause}
      ORDER BY i.ticker ASC
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
}
