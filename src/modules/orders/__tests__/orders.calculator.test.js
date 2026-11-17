import { calculateOrderSizeFromAmount, calculateWeightedAvgCost } from '../orders.calculator.js';

describe('orders.calculator', () => {
  test('calculateOrderSizeFromAmount floors fractional shares', () => {
    expect(calculateOrderSizeFromAmount(1000, 300)).toBe(3);
    expect(calculateOrderSizeFromAmount(999.99, 500)).toBe(1);
    expect(calculateOrderSizeFromAmount(250, 300)).toBe(0);
  });

  test('calculateOrderSizeFromAmount throws on non-positive price', () => {
    expect(() => calculateOrderSizeFromAmount(1000, 0)).toThrow();
  });

  test('calculateWeightedAvgCost computes weighted average accurately', () => {
    const avg = calculateWeightedAvgCost('10.00', '100.0000', 10, '200.00');
    expect(avg.toFixed(4)).toBe('150.0000');

    const initialAvg = calculateWeightedAvgCost('0.00', '0.0000', 5, '925.85');
    expect(initialAvg.toFixed(4)).toBe('925.8500');
  });
});
