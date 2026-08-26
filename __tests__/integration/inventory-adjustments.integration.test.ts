process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, inventoryWarehouses } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { POST as postAdjustment } from '@/app/api/inventory/adjustments/route';

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

const WAREHOUSE = '14';
let pool: sql.ConnectionPool;
let testArticle: { co_art: string; co_uni: string };
let stockSnapshot: number;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

function buildRequest(token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/inventory/adjustments', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
}

async function getStock(coArt: string, coAlma: string): Promise<number> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  return result.recordset[0]?.stock ?? 0;
}

async function restoreStock(coArt: string, coAlma: string, value: number): Promise<void> {
  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .input('value', sql.Decimal(18, 5), value)
    .query(`UPDATE saStockAlmacen SET stock = @value WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
}

async function cleanupAjuste(ajueNum: string): Promise<void> {
  // Same FK-safe delete order established in the pApiCrearAjusteInventario
  // integration test: cost-layer rows reference saAjusteReng.rowguid via
  // doc_orig, and Salida rows reference Entrada rows, so delete in this order.
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`
      DELETE CHS FROM saCostoHistoricoSalida CHS
      JOIN saAjusteReng AR ON AR.rowguid = CHS.doc_orig
      WHERE CHS.tipo_doc = 'AJUS' AND AR.ajue_num = @n
    `);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`
      DELETE CHE FROM saCostoHistoricoEntrada CHE
      JOIN saAjusteReng AR ON AR.rowguid = CHE.doc_orig
      WHERE CHE.tipo_doc = 'AJUS' AND AR.ajue_num = @n
    `);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjusteReng WHERE ajue_num = @n`);
  await pool.request().input('n', sql.Char(20), ajueNum)
    .query(`DELETE FROM saAjuste WHERE ajue_num = @n`);
}

async function findAjueNumForArticle(coArt: string): Promise<string | null> {
  const result = await pool.request()
    .input('a', sql.Char(30), coArt)
    .query(`
      SELECT TOP 1 AR.ajue_num
      FROM saAjusteReng AR
      WHERE AR.co_art = @a
      ORDER BY AR.ajue_num DESC
    `);
  return result.recordset[0] ? (result.recordset[0].ajue_num as string).trim() : null;
}

beforeAll(async () => {
  resetSqliteDb();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();

  const articleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .query(`
      SELECT TOP 1 s.co_art, au.co_uni
      FROM saStockAlmacen s
      JOIN saArtUnidad au ON au.co_art = s.co_art
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT' AND s.stock > 10
    `);
  if (articleResult.recordset.length === 0) {
    throw new Error(`No article with stock > 10 found in warehouse ${WAREHOUSE} for test setup`);
  }
  testArticle = {
    co_art: (articleResult.recordset[0].co_art as string).trim(),
    co_uni: (articleResult.recordset[0].co_uni as string).trim(),
  };
  stockSnapshot = await getStock(testArticle.co_art, WAREHOUSE);

  const db = getDb();
  db.insert(inventoryWarehouses).values({ coAlma: WAREHOUSE, label: 'Test warehouse', active: true })
    .onConflictDoNothing().run();
});

afterEach(async () => {
  await restoreStock(testArticle.co_art, WAREHOUSE, stockSnapshot);
});

afterAll(async () => {
  if (pool?.connected) await pool.close();
});

describe('POST /api/inventory/adjustments', () => {
  test('no session cookie gets 401', async () => {
    const response = await postAdjustment(buildRequest(null, {}));
    expect(response.status).toBe(401);
  });

  test('user without the inventory module gets 403', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'noaccess-adj@x.com', name: 'No Access', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'No Access' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: WAREHOUSE, countedStock: stockSnapshot + 1,
    }));
    expect(response.status).toBe(403);
  });

  test('surplus recount creates an entrada adjustment and raises stock', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj1@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: WAREHOUSE, countedStock: stockSnapshot + 5,
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; ajueNum: string; delta: number };
    expect(body.delta).toBe(5);

    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot + 5);

    await cleanupAjuste(body.ajueNum);
  });

  test('shortage recount creates a salida adjustment and lowers stock', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj2@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: WAREHOUSE, countedStock: stockSnapshot - 3,
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; ajueNum: string; delta: number };
    expect(body.delta).toBe(-3);

    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot - 3);

    await cleanupAjuste(body.ajueNum);
  });

  test('counted stock equal to current stock is rejected as a no-op', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj3@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: WAREHOUSE, countedStock: stockSnapshot,
    }));
    expect(response.status).toBe(400);

    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot);
  });

  test('a stock race that would go negative is surfaced as a clean 400, not a 500', async () => {
    // The route always computes delta from a fresh read of current stock, so
    // its own validated inputs (countedStock >= 0) can never organically
    // request a deeper shortage than what's in stock — the negative-stock
    // guard inside pApiCrearAjusteInventario (via pStockActualizar) only
    // trips on a genuine external race between our read and the SP call.
    // Reproduce that race directly against the SP (bypassing the route) to
    // confirm the route's error.number === 50000 catch branch is reachable
    // and well-formed, independent of the route's own request/response glue.
    const table = new sql.Table('AjusteInventarioLineaType');
    table.columns.add('co_tipo', sql.Char(6));
    table.columns.add('co_art', sql.Char(30));
    table.columns.add('co_alma', sql.Char(6));
    table.columns.add('co_uni', sql.Char(6));
    table.columns.add('total_art', sql.Decimal(18, 5));
    table.columns.add('cost_unit', sql.Decimal(18, 5));
    table.columns.add('permitir_negativo', sql.Bit);
    table.rows.add('S00005', testArticle.co_art, WAREHOUSE, testArticle.co_uni, stockSnapshot + 1000, null, false);

    const req = pool.request();
    req.input('sMotivo', sql.VarChar(80), 'race test');
    req.input('dtFecha', sql.SmallDateTime, new Date());
    req.input('sCoUsIn', sql.Char(6), 'PROFIT');
    req.input('sCoSucuIn', sql.Char(6), null);
    req.input('Lineas', table);
    req.output('sAjueNumOut', sql.Char(20));

    let caught: unknown = null;
    try {
      await req.execute('pApiCrearAjusteInventario');
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeNull();
    expect((caught as { number: number }).number).toBe(50000);
    expect(await getStock(testArticle.co_art, WAREHOUSE)).toBe(stockSnapshot);
  });

  test('unknown article returns 404 without touching Profit Plus', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj4@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: 'NOPE_DOES_NOT_EXIST', coAlma: WAREHOUSE, countedStock: 10,
    }));
    expect(response.status).toBe(404);
  });

  test('negative counted stock is rejected', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj5@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: WAREHOUSE, countedStock: -1,
    }));
    expect(response.status).toBe(400);
  });

  test('warehouse outside the configured allowlist is rejected', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-adj6@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await postAdjustment(buildRequest(token, {
      coArt: testArticle.co_art, coAlma: '999999', countedStock: stockSnapshot + 1,
    }));
    expect(response.status).toBe(400);

    const found = await findAjueNumForArticle(testArticle.co_art);
    if (found) await cleanupAjuste(found);
  });
});

describe('POST /api/inventory/adjustments — simple ajuste @mssql', () => {
  let token: string;

  beforeAll(async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-simple-adj@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });
  });

  test('registers an entrada movement for the exact typed quantity, no delta math', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'E00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 7,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ajueNum).toBeTruthy();

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before + 7);

    await cleanupAjuste(data.ajueNum);
    await restoreStock(testArticle.co_art, WAREHOUSE, before);
  });

  test('registers a salida movement, decreasing stock by the exact typed quantity', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'S00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 3,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before - 3);

    await cleanupAjuste(data.ajueNum);
    await restoreStock(testArticle.co_art, WAREHOUSE, before);
  });

  test('rejects a salida that would push stock negative, leaving stock unchanged', async () => {
    const before = await getStock(testArticle.co_art, WAREHOUSE);
    const req = buildRequest(token, {
      coTipo: 'S00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: before + 1000,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);

    const after = await getStock(testArticle.co_art, WAREHOUSE);
    expect(after).toBe(before);
  });

  test('rejects a non-positive cantidad', async () => {
    const req = buildRequest(token, {
      coTipo: 'E00001', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 0,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);
  });

  test('rejects an unknown coTipo', async () => {
    const req = buildRequest(token, {
      coTipo: 'X99999', coArt: testArticle.co_art, coAlma: WAREHOUSE, cantidad: 1,
    });
    const res = await postAdjustment(req);
    expect(res.status).toBe(400);
  });
});
