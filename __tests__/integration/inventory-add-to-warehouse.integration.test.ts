process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, inventoryWarehouses } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { POST as postAddWarehouse } from '@/app/api/inventory/items/[co_art]/warehouses/route';

function buildTestConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT ?? '1433'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false',
    },
  };
}

// Pick a real co_art that has NO existing saStockAlmacen row in TEST_WAREHOUSE
// at test-DB setup time — confirm with a SELECT in beforeAll, and skip/fail
// loudly if the fixture assumption doesn't hold rather than silently no-op.
const TEST_WAREHOUSE = '14';
let pool: sql.ConnectionPool;
let testArticleWithoutStock: string;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

function buildRequest(coArt: string, token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest(`http://localhost:3000/api/inventory/items/${coArt}/warehouses`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
}

describe('POST /api/inventory/items/[co_art]/warehouses @mssql', () => {
  beforeAll(async () => {
    pool = await new sql.ConnectionPool(buildTestConfig()).connect();
    const result = await pool.request().input('coAlma', sql.Char(6), TEST_WAREHOUSE).query(`
      SELECT TOP 1 a.co_art
      FROM saArticulo a
      WHERE a.anulado = 0
        AND NOT EXISTS (
          SELECT 1 FROM saStockAlmacen s
          WHERE s.co_art = a.co_art AND s.co_alma = @coAlma AND s.tipo = 'ACT'
        )
    `);
    if (result.recordset.length === 0) {
      throw new Error(`No article without a stock row in warehouse ${TEST_WAREHOUSE} found — test fixture assumption broken`);
    }
    testArticleWithoutStock = (result.recordset[0].co_art as string).trim();
  });

  afterEach(async () => {
    resetSqliteDb();
    await pool.request()
      .input('coArt', sql.Char(30), testArticleWithoutStock)
      .input('coAlma', sql.Char(6), TEST_WAREHOUSE)
      .query(`DELETE FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  });

  afterAll(async () => {
    await pool.close();
  });

  test('creates a zero-stock row for an article missing one in a configured warehouse', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'wh-test@e2e.test', passwordHash: 'x', name: 'WH Test', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    db.insert(inventoryWarehouses).values({ coAlma: TEST_WAREHOUSE, label: 'Materia Prima', active: true }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'WH Test' });

    const req = buildRequest(testArticleWithoutStock, token, { coAlma: TEST_WAREHOUSE });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(200);

    const check = await pool.request()
      .input('coArt', sql.Char(30), testArticleWithoutStock)
      .input('coAlma', sql.Char(6), TEST_WAREHOUSE)
      .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
    expect(check.recordset.length).toBe(1);
    expect(Number(check.recordset[0].stock)).toBe(0);
  });

  test('rejects a warehouse not in the configured allowlist', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'wh-test2@e2e.test', passwordHash: 'x', name: 'WH Test 2', role: 'user',
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    db.insert(inventoryWarehouses).values({ coAlma: TEST_WAREHOUSE, label: 'Materia Prima', active: true }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'WH Test 2' });

    const req = buildRequest(testArticleWithoutStock, token, { coAlma: '999999' });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(400);
  });

  test('returns 401 without a session', async () => {
    const req = buildRequest(testArticleWithoutStock, null, { coAlma: TEST_WAREHOUSE });
    const res = await postAddWarehouse(req, { params: Promise.resolve({ co_art: testArticleWithoutStock }) });
    expect(res.status).toBe(401);
  });
});
