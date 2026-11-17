import Decimal from 'decimal.js';
import { BASE_CURRENCY, INSTRUMENT_TYPES } from '../../config/constants.js';

/**
 * Pure domain calculator for portfolio valuation and returns.
 * @param {Array<{
 *   instrumentId: number,
 *   ticker: string,
 *   name: string,
 *   type: string,
 *   qty: string | number,
 *   reservedQty: string | number,
 *   avgCost: string | number,
 *   marketClose: string | number | null,
 * }>} positionRows
 */
export function calculatePortfolioSummary(positionRows) {
  let totalCash = new Decimal(0);
  let reservedCash = new Decimal(0);
  let totalAssetsValue = new Decimal(0);
  const assets = [];

  for (const row of positionRows) {
    const qty = new Decimal(row.qty ?? 0);
    const reservedQty = new Decimal(row.reservedQty ?? 0);

    if (row.type === INSTRUMENT_TYPES.CURRENCY) {
      totalCash = totalCash.plus(qty);
      reservedCash = reservedCash.plus(reservedQty);
      continue;
    }

    if (qty.lte(0)) {
      continue;
    }

    const avgCost = new Decimal(row.avgCost ?? 0);
    const currentPrice = row.marketClose !== null && row.marketClose !== undefined
      ? new Decimal(row.marketClose)
      : avgCost;

    const marketValue = qty.times(currentPrice);
    const totalReturnPct = avgCost.gt(0)
      ? currentPrice.minus(avgCost).div(avgCost).times(100)
      : new Decimal(0);

    totalAssetsValue = totalAssetsValue.plus(marketValue);

    assets.push({
      instrumentId: row.instrumentId,
      ticker: row.ticker,
      name: row.name,
      currency: BASE_CURRENCY,
      qty: Number(qty.toFixed(0)),
      price: Number(currentPrice.toFixed(2)),
      marketValue: Number(marketValue.toFixed(2)),
      totalReturnPct: Number(totalReturnPct.toFixed(2)),
    });
  }

  const availableCash = totalCash.minus(reservedCash);
  const totalAccountValue = totalCash.plus(totalAssetsValue);

  return {
    totalAccountValue: Number(totalAccountValue.toFixed(2)),
    totalCash: Number(totalCash.toFixed(2)),
    availableCash: Number(availableCash.toFixed(2)),
    reservedCash: Number(reservedCash.toFixed(2)),
    assets,
  };
}
