import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { setupTestDatabase, resetTestData, teardownTestDatabase } from '../../../test/testDbHelper.js';

const app = createApp();

describe('POST /api/orders & PATCH /api/orders/:orderId/cancel (Functional)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  test('executes CASH_IN, MARKET BUY by amount, MARKET SELL, and CASH_OUT (RF-03, RF-05, RF-08)', async () => {
    const cashIn = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 5000 });
    expect(cashIn.status).toBe(201);
    expect(cashIn.body.status).toBe('FILLED');

    // Buy PAMP (close = 1000) with amount = 2500 -> floor(2500/1000) = 2 shares
    const buyRes = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', amount: 2500 });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.status).toBe('FILLED');
    expect(buyRes.body.size).toBe(2);
    expect(Number(buyRes.body.price)).toBe(1000);

    // Sell 1 PAMP
    const sellRes = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'SELL', type: 'MARKET', size: 1 });
    expect(sellRes.status).toBe(201);
    expect(sellRes.body.status).toBe('FILLED');

    // Cash out 1000
    const cashOut = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_OUT', type: 'MARKET', size: 1000 });
    expect(cashOut.status).toBe(201);
    expect(cashOut.body.status).toBe('FILLED');
  });

  test('rejects order with status REJECTED when funds or shares are insufficient (RF-07)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REJECTED');
  });

  test('enforces idempotency via Idempotency-Key UUID (RF-02)', async () => {
    const key = crypto.randomUUID();

    const first = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 1000 });

    const second = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 1000 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const portfolio = await request(app).get('/api/portfolio/1');
    expect(portfolio.body.totalCash).toBe(1000);
  });

  test('creates LIMIT order as NEW, reserves funds, and releases on cancel (RF-06, RF-10)', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 2000 });

    const limitOrder = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'LIMIT', size: 2, price: 800 });

    expect(limitOrder.status).toBe(201);
    expect(limitOrder.body.status).toBe('NEW');

    const beforeCancel = await request(app).get('/api/portfolio/1');
    expect(beforeCancel.body.availableCash).toBe(400);
    expect(beforeCancel.body.reservedCash).toBe(1600);

    const cancelRes = await request(app).patch(`/api/orders/${limitOrder.body.id}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const afterCancel = await request(app).get('/api/portfolio/1');
    expect(afterCancel.body.availableCash).toBe(2000);
    expect(afterCancel.body.reservedCash).toBe(0);

    // Cancelling again returns 409 Conflict
    const secondCancel = await request(app).patch(`/api/orders/${limitOrder.body.id}/cancel`);
    expect(secondCancel.status).toBe(409);
  });

  test('prevents double-spending under concurrent BUY requests (RF-09)', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 1000 });

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/orders')
        .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1 }),
      request(app)
        .post('/api/orders')
        .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1 }),
    ]);

    const statuses = [resA.body.status, resB.body.status].sort();
    expect(statuses).toEqual(['FILLED', 'REJECTED']);

    const portfolio = await request(app).get('/api/portfolio/1');
    expect(portfolio.body.totalCash).toBe(0);
    expect(portfolio.body.availableCash).toBe(0);
  });

  test('returns 400 when amount cannot buy at least 1 share (RF-03)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', amount: 500 });

    expect(res.status).toBe(400);
  });

  test('lists paginated orders for a user with optional status filter', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 3000 });

    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'LIMIT', size: 1, price: 800 });

    const allRes = await request(app).get('/api/orders?userId=1&limit=10&offset=0');
    expect(allRes.status).toBe(200);
    expect(allRes.body.pagination.total).toBe(2);

    const newOnly = await request(app).get('/api/orders?userId=1&status=NEW');
    expect(newOnly.status).toBe(200);
    expect(newOnly.body.data).toHaveLength(1);
    expect(newOnly.body.data[0].status).toBe('NEW');

    const notFound = await request(app).get('/api/orders?userId=999');
    expect(notFound.status).toBe(404);
  });

  test('returns accurate HTTP error codes for edge cases (400, 404, 409, 422)', async () => {
    // 400: price overflow for NUMERIC(10,2)
    const priceOverflow = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'SELL', type: 'LIMIT', size: 1, price: 1500000000 });
    expect(priceOverflow.status).toBe(400);

    // 400: both size and amount
    const bothSizeAmount = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1, amount: 1000 });
    expect(bothSizeAmount.status).toBe(400);

    // 400: LIMIT without price
    const limitNoPrice = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'LIMIT', size: 1 });
    expect(limitNoPrice.status).toBe(400);

    // 400: MARKET with price
    const marketWithPrice = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1, price: 500 });
    expect(marketWithPrice.status).toBe(400);

    // 400: BUY on MONEDA instrument
    const buyMoneda = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'BUY', type: 'MARKET', size: 100 });
    expect(buyMoneda.status).toBe(400);

    // 404: non-existent user / instrument / order
    const user404 = await request(app)
      .post('/api/orders')
      .send({ userId: 999, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 1 });
    expect(user404.status).toBe(404);

    const inst404 = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 999, side: 'BUY', type: 'MARKET', size: 1 });
    expect(inst404.status).toBe(404);

    const cancel404 = await request(app).patch('/api/orders/99999/cancel');
    expect(cancel404.status).toBe(404);

    // 422: MARKET order on instrument without marketdata (YPFD id=4)
    const noMarketData = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 4, side: 'BUY', type: 'MARKET', size: 1 });
    expect(noMarketData.status).toBe(422);

    // 409: cancelling a FILLED order
    const filledOrder = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 1000 });
    const cancelFilled = await request(app).patch(`/api/orders/${filledOrder.body.id}/cancel`);
    expect(cancelFilled.status).toBe(409);

    // 400: boolean userId in JSON body must be rejected
    const boolUser = await request(app)
      .post('/api/orders')
      .send({ userId: true, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 100 });
    expect(boolUser.status).toBe(400);

    // 400: size * price exceeding NUMERIC(18,2) capacity
    const totalOverflow = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'LIMIT', size: 2000000000, price: 99999999 });
    expect(totalOverflow.status).toBe(400);
  });

  test('rejects 422 when reusing Idempotency-Key with a different payload', async () => {
    const key = crypto.randomUUID();

    const first = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 1000 });
    expect(first.status).toBe(201);

    const mismatch = await request(app)
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 2000 });
    expect(mismatch.status).toBe(422);
  });

  test('transitions NEW LIMIT order to FILLED or REJECTED via PATCH /status and updates portfolio', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 5000 });

    // Create LIMIT BUY (NEW) -> reserves 1600
    const limitBuy = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'LIMIT', size: 2, price: 800 });
    expect(limitBuy.body.status).toBe('NEW');

    // Transition NEW -> FILLED
    const filledRes = await request(app)
      .patch(`/api/orders/${limitBuy.body.id}/status`)
      .send({ status: 'FILLED' });
    expect(filledRes.status).toBe(200);
    expect(filledRes.body.status).toBe('FILLED');

    // Portfolio must show cash settled (3400), reservedCash=0, and 2 PAMP shares
    const portfolioAfterFill = await request(app).get('/api/portfolio/1');
    expect(portfolioAfterFill.body.totalCash).toBe(3400);
    expect(portfolioAfterFill.body.reservedCash).toBe(0);
    expect(portfolioAfterFill.body.assets[0].qty).toBe(2);

    // Transitioning already FILLED order returns 409
    const conflictRes = await request(app)
      .patch(`/api/orders/${limitBuy.body.id}/status`)
      .send({ status: 'CANCELLED' });
    expect(conflictRes.status).toBe(409);

    // Create LIMIT SELL (NEW) and transition to REJECTED -> releases reserved shares
    const limitSell = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'SELL', type: 'LIMIT', size: 2, price: 1200 });
    expect(limitSell.body.status).toBe('NEW');

    const rejectedRes = await request(app)
      .patch(`/api/orders/${limitSell.body.id}/status`)
      .send({ status: 'REJECTED' });
    expect(rejectedRes.status).toBe(200);
    expect(rejectedRes.body.status).toBe('REJECTED');

    // User can still sell the 2 shares because reservation was released
    const marketSell = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'SELL', type: 'MARKET', size: 2 });
    expect(marketSell.body.status).toBe('FILLED');
  });
});
