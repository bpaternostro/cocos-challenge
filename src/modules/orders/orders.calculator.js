import Decimal from 'decimal.js';

/**
 * Calculates integer share quantity from an investment amount in ARS.
 * Fractional shares are not allowed.
 * @param {string | number} amount
 * @param {string | number} price
 * @returns {number}
 */
export function calculateOrderSizeFromAmount(amount, price) {
  const decAmount = new Decimal(amount);
  const decPrice = new Decimal(price);

  if (decPrice.lte(0)) {
    throw new Error('Price must be greater than zero');
  }

  return decAmount.div(decPrice).floor().toNumber();
}

/**
 * Calculates new weighted average cost after a BUY execution.
 * @param {string | number} currentQty
 * @param {string | number} currentAvgCost
 * @param {number} boughtQty
 * @param {string | number} buyPrice
 * @returns {Decimal}
 */
export function calculateWeightedAvgCost(currentQty, currentAvgCost, boughtQty, buyPrice) {
  const decCurrentQty = new Decimal(currentQty);
  const decCurrentAvgCost = new Decimal(currentAvgCost);
  const decBoughtQty = new Decimal(boughtQty);
  const decBuyPrice = new Decimal(buyPrice);

  const newQty = decCurrentQty.plus(decBoughtQty);
  if (newQty.lte(0)) {
    return new Decimal(0);
  }

  return decCurrentQty
    .times(decCurrentAvgCost)
    .plus(decBoughtQty.times(decBuyPrice))
    .div(newQty);
}
