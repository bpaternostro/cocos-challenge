import request from 'supertest';
import { createApp } from '../../../app.js';
import { setupTestDatabase, resetTestData, teardownTestDatabase } from '../../../test/testDbHelper.js';

const app = createApp();

describe('GET /api/portfolio/:userId (Functional)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  test('returns 404 when user does not exist (RF-02)', async () => {
    const res = await request(app).get('/api/portfolio/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('User not found');
  });

  test('returns empty portfolio for user with no orders (RF-01)', async () => {
    const res = await request(app).get('/api/portfolio/2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: 2,
      accountNumber: '10002',
      currency: 'ARS',
      totalAccountValue: 0,
      totalCash: 0,
      availableCash: 0,
      reservedCash: 0,
      assets: [],
    });
  });

  test('reflects cash, reserved cash from LIMIT NEW, and active positions (RF-01, RF-03, RF-04, RF-07)', async () => {
    // 1. CASH_IN 10000 ARS
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 10000 });

    // 2. MARKET BUY 3 PAMP @ 1000 = 3000 ARS
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 3 });

    // 3. LIMIT BUY 2 GGAL @ 450 = 900 ARS (NEW -> reserved)
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 3, side: 'BUY', type: 'LIMIT', size: 2, price: 450 });

    const res = await request(app).get('/api/portfolio/1');
    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('ARS');
    expect(res.body.totalCash).toBe(7000);
    expect(res.body.reservedCash).toBe(900);
    expect(res.body.availableCash).toBe(6100);
    expect(res.body.totalAccountValue).toBe(10000);
    expect(res.body.assets).toEqual([
      {
        instrumentId: 2,
        ticker: 'PAMP',
        name: 'Pampa Energía S.A.',
        currency: 'ARS',
        qty: 3,
        price: 1000,
        marketValue: 3000,
        totalReturnPct: 0,
      },
    ]);
  });

  test('updates portfolio on full SELL (omits qty=0) and keeps portfolio unchanged on REJECTED order', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 1, side: 'CASH_IN', type: 'MARKET', size: 2000 });

    await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 2 });

    // REJECTED BUY should not alter cash or positions
    const rejected = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'BUY', type: 'MARKET', size: 5 });
    expect(rejected.body.status).toBe('REJECTED');

    // Full SELL of 2 PAMP -> qty becomes 0 and position is omitted
    const sellAll = await request(app)
      .post('/api/orders')
      .send({ userId: 1, instrumentId: 2, side: 'SELL', type: 'MARKET', size: 2 });
    expect(sellAll.body.status).toBe('FILLED');

    const portfolio = await request(app).get('/api/portfolio/1');
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.totalCash).toBe(2000);
    expect(portfolio.body.availableCash).toBe(2000);
    expect(portfolio.body.assets).toEqual([]);
  });

  test('returns 400 for invalid userId parameter', async () => {
    const invalid = await request(app).get('/api/portfolio/abc');
    expect(invalid.status).toBe(400);

    const overflow = await request(app).get('/api/portfolio/9999999999');
    expect(overflow.status).toBe(400);
  });
});
