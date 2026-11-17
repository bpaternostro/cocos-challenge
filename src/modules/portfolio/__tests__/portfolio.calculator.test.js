import { calculatePortfolioSummary } from '../portfolio.calculator.js';

describe('calculatePortfolioSummary', () => {
  test('computes cash, availableCash, assets valuation and return % accurately', () => {
    const result = calculatePortfolioSummary([
      {
        instrumentId: 66,
        ticker: 'ARS',
        name: 'Pesos',
        type: 'MONEDA',
        qty: '10000.00',
        reservedQty: '2500.00',
        avgCost: '1.0000',
        marketClose: null,
      },
      {
        instrumentId: 47,
        ticker: 'PAMP',
        name: 'Pampa Energía',
        type: 'ACCIONES',
        qty: '10.00',
        reservedQty: '0.00',
        avgCost: '800.0000',
        marketClose: '1000.00',
      },
    ]);

    expect(result).toEqual({
      totalAccountValue: 20000,
      totalCash: 10000,
      availableCash: 7500,
      reservedCash: 2500,
      assets: [
        {
          instrumentId: 47,
          ticker: 'PAMP',
          name: 'Pampa Energía',
          currency: 'ARS',
          qty: 10,
          price: 1000,
          marketValue: 10000,
          totalReturnPct: 25,
        },
      ],
    });
  });

  test('omits closed positions (qty <= 0) and handles avgCost = 0 safely', () => {
    const result = calculatePortfolioSummary([
      {
        instrumentId: 47,
        ticker: 'PAMP',
        name: 'Pampa Energía',
        type: 'ACCIONES',
        qty: '0.00',
        reservedQty: '0.00',
        avgCost: '0.0000',
        marketClose: '1000.00',
      },
      {
        instrumentId: 34,
        ticker: 'GGAL',
        name: 'Grupo Financiero Galicia',
        type: 'ACCIONES',
        qty: '5.00',
        reservedQty: '0.00',
        avgCost: '0.0000',
        marketClose: null,
      },
    ]);

    expect(result.assets).toEqual([
      {
        instrumentId: 34,
        ticker: 'GGAL',
        name: 'Grupo Financiero Galicia',
        currency: 'ARS',
        qty: 5,
        price: 0,
        marketValue: 0,
        totalReturnPct: 0,
      },
    ]);
  });

  test('returns zeros and empty assets when user has no positions', () => {
    expect(calculatePortfolioSummary([])).toEqual({
      totalAccountValue: 0,
      totalCash: 0,
      availableCash: 0,
      reservedCash: 0,
      assets: [],
    });
  });
});
