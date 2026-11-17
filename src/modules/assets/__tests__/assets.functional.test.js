import request from 'supertest';
import { createApp } from '../../../app.js';
import { setupTestDatabase, teardownTestDatabase } from '../../../test/testDbHelper.js';

const app = createApp();

describe('GET /api/assets (Functional)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  test('lists operable assets excluding MONEDA by default ordered by ticker (RF-03, RF-04)', async () => {
    const res = await request(app).get('/api/assets');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ total: 3, limit: 20, offset: 0 });
    expect(res.body.data.map((a) => a.ticker)).toEqual(['GGAL', 'PAMP', 'YPFD']);
  });

  test('filters by partial case-insensitive query on ticker or name (RF-01, RF-06)', async () => {
    const res = await request(app).get('/api/assets?query=pamp');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: 2,
        ticker: 'PAMP',
        name: 'Pampa Energía S.A.',
        type: 'ACCIONES',
        currency: 'ARS',
        close: 1000,
        dailyReturnPct: 5.26,
      },
    ]);
  });

  test('allows explicit type=MONEDA filter (RF-02)', async () => {
    const res = await request(app).get('/api/assets?type=MONEDA');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticker).toBe('ARS');
    expect(res.body.data[0].close).toBeNull();
  });

  test('supports pagination and rejects invalid limit (RF-05)', async () => {
    const pageRes = await request(app).get('/api/assets?limit=2&offset=1');
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.pagination).toEqual({ total: 3, limit: 2, offset: 1 });
    expect(pageRes.body.data.map((a) => a.ticker)).toEqual(['PAMP', 'YPFD']);

    const badRes = await request(app).get('/api/assets?limit=150');
    expect(badRes.status).toBe(400);
  });

  test('supports bulk lookup by exact tickers and multi-term queries', async () => {
    const tickersRes = await request(app).get('/api/assets?tickers=GGAL,YPFD');
    expect(tickersRes.status).toBe(200);
    expect(tickersRes.body.data.map((a) => a.ticker)).toEqual(['GGAL', 'YPFD']);

    const queriesRes = await request(app).get('/api/assets?queries=galicia,ypf');
    expect(queriesRes.status).toBe(200);
    expect(queriesRes.body.data.map((a) => a.ticker)).toEqual(['GGAL', 'YPFD']);
  });

  test('neutralizes SQLi and LIKE wildcard injection payloads safely', async () => {
    const sqliQuery = await request(app).get("/api/assets?query=' OR '1'='1' --");
    expect(sqliQuery.status).toBe(200);
    expect(sqliQuery.body.data).toEqual([]);

    const sqliTickers = await request(app).get("/api/assets?tickers=GGAL' OR 1=1--");
    expect(sqliTickers.status).toBe(200);
    expect(sqliTickers.body.data).toEqual([]);

    const sqliLongTickers = await request(app).get("/api/assets?tickers=GGAL'; DROP TABLE orders; --");
    expect(sqliLongTickers.status).toBe(400);

    const wildcard = await request(app).get('/api/assets?query=%25');
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data).toEqual([]);

    const offsetOverflow = await request(app).get('/api/assets?offset=999999999999');
    expect(offsetOverflow.status).toBe(400);
  });
});
