import Decimal from 'decimal.js';
import { BASE_CURRENCY } from '../../config/constants.js';
import { AssetsRepository } from './assets.repository.js';

export class AssetsService {
  /**
   * @param {{ query?: string, type?: string, limit: number, offset: number }} params
   */
  static async searchAssets(params) {
    const { rows, total } = await AssetsRepository.searchAssets(params);

    const data = rows.map((row) => {
      const hasClose = row.close !== null && row.close !== undefined;
      const hasPrev = row.previousClose !== null && row.previousClose !== undefined;

      let dailyReturnPct = null;
      if (hasClose && hasPrev && new Decimal(row.previousClose).gt(0)) {
        dailyReturnPct = Number(
          new Decimal(row.close)
            .minus(row.previousClose)
            .div(row.previousClose)
            .times(100)
            .toFixed(2),
        );
      }

      return {
        id: row.id,
        ticker: row.ticker,
        name: row.name,
        type: row.type,
        currency: BASE_CURRENCY,
        close: hasClose ? Number(new Decimal(row.close).toFixed(2)) : null,
        dailyReturnPct,
      };
    });

    return {
      data,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    };
  }
}
