process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, inventoryWarehouses } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getItems } from '@/app/api/inventory/items/route';
import { PATCH as patchItem } from '@/app/api/inventory/items/[co_art]/route';

function buildRequest(token: string | null, init: { method: string; body?: string }, url = 'http://localhost:3000/api/test'): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers,
  });
}

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

function buildMssqlConfig(): sql.config {
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

let pool: sql.ConnectionPool;
let testArticle: { co_art: string; art_des: string; ref: string | null; stock_min: number };
const WAREHOUSE = '14';

async function getArticleSnapshot(coArt: string) {
  const result = await pool.request().input('coArt', sql.Char(30), coArt)
    .query('SELECT co_art, art_des, ref, stock_min FROM saArticulo WHERE co_art = @coArt');
  const row = result.recordset[0];
  return {
    co_art: (row.co_art as string).trim(),
    art_des: (row.art_des as string).trim(),
    ref: row.ref === null ? null : (row.ref as string).trim(),
    stock_min: Number(row.stock_min),
  };
}

async function restoreArticle(snapshot: typeof testArticle) {
  await pool.request()
    .input('coArt', sql.Char(30), snapshot.co_art)
    .input('artDes', sql.VarChar(120), snapshot.art_des)
    .input('ref', sql.VarChar(20), snapshot.ref)
    .input('stockMin', sql.Decimal(18, 5), snapshot.stock_min)
    .query('UPDATE saArticulo SET art_des = @artDes, ref = @ref, stock_min = @stockMin WHERE co_art = @coArt');
}

beforeAll(async () => {
  pool = await new sql.ConnectionPool(buildMssqlConfig()).connect();

  const articleResult = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .query(`
      SELECT TOP 1 a.co_art
      FROM saArticulo a
      JOIN saStockAlmacen s ON s.co_art = a.co_art AND s.tipo = 'ACT'
      WHERE a.anulado = 0 AND s.co_alma = @coAlma
    `);
  if (articleResult.recordset.length === 0) {
    throw new Error(`No active article with stock in warehouse ${WAREHOUSE} for test setup`);
  }
  testArticle = await getArticleSnapshot((articleResult.recordset[0].co_art as string).trim());
});

afterAll(async () => {
  await restoreArticle(testArticle);
  if (pool?.connected) await pool.close();
});

describe('GET /api/inventory/items', () => {
  beforeEach(() => {
    resetSqliteDb();
  });

  test('user without the inventory module gets 403', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'noaccess@x.com', name: 'No Access', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'No Access' });

    const response = await getItems(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(403);
  });

  test('no session cookie gets 401', async () => {
    const response = await getItems(buildRequest(null, { method: 'GET' }));
    expect(response.status).toBe(401);
  });

  test('user with the inventory module can list items and sees the test article', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'manager@x.com', name: 'Manager', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Manager' });

    const response = await getItems(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(200);

    const body = await response.json() as Array<{ coArt: string; artDes: string }>;
    expect(body.some(item => item.coArt === testArticle.co_art)).toBe(true);
  });

  test('includes the article\'s unit of measure', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-unidad@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getItems(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(200);

    const body = await response.json() as Array<{ coArt: string; unidad: string | null }>;
    const testItem = body.find(item => item.coArt === testArticle.co_art);
    expect(testItem).toBeDefined();
    expect(typeof testItem!.unidad).toBe('string');
    expect(testItem!.unidad!.length).toBeGreaterThan(0);
  });

  test('admin can list items without an explicit module grant', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getItems(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(200);
  });

  test('respects the active warehouse allowlist when configured', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    // Configure an allowlist that excludes warehouse 14 entirely.
    db.insert(inventoryWarehouses).values({ coAlma: '999999', label: 'Nowhere', active: true }).run();

    const response = await getItems(buildRequest(token, { method: 'GET' }));
    const body = await response.json() as Array<{ coArt: string; coAlma: string }>;
    expect(body.some(item => item.coAlma === WAREHOUSE)).toBe(false);
  });
});

describe('GET /api/inventory/items?unstocked=true', () => {
  beforeEach(() => {
    resetSqliteDb();
  });

  test('requires co_alma', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-unstocked1@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getItems(buildRequest(
      token, { method: 'GET' }, 'http://localhost:3000/api/inventory/items?unstocked=true',
    ));
    expect(response.status).toBe(400);
  });

  test('lists articles missing a stock row in the requested warehouse, excluding the stocked test article', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-unstocked2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getItems(buildRequest(
      token, { method: 'GET' },
      `http://localhost:3000/api/inventory/items?unstocked=true&co_alma=${encodeURIComponent(WAREHOUSE)}`,
    ));
    expect(response.status).toBe(200);

    const body = await response.json() as Array<{ coArt: string; artDes: string }>;
    // testArticle has a stock row in WAREHOUSE (set up in the top-level beforeAll),
    // so it must never appear in the "missing stock" list for that warehouse.
    expect(body.some(item => item.coArt === testArticle.co_art)).toBe(false);
  });

  test('user without the inventory module gets 403', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'noaccess-unstocked@x.com', name: 'No Access', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'No Access' });

    const response = await getItems(buildRequest(
      token, { method: 'GET' },
      `http://localhost:3000/api/inventory/items?unstocked=true&co_alma=${encodeURIComponent(WAREHOUSE)}`,
    ));
    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/inventory/items/:co_art', () => {
  beforeEach(() => {
    resetSqliteDb();
  });

  test('user with the inventory module can update safe fields', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ art_des: 'Updated Name', stock_min: 0 }) }),
      { params: Promise.resolve({ co_art: testArticle.co_art }) },
    );
    expect(response.status).toBe(200);

    const updated = await getArticleSnapshot(testArticle.co_art);
    expect(updated.art_des).toBe('Updated Name');
    expect(updated.stock_min).toBe(0);

    await restoreArticle(testArticle);
  });

  test('surfaces a clear error when stock_min/stock_max ordering is violated', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor3@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    // The live DB enforces CK_saArticulo_Stock: stock_min <= stock_max.
    // Setting only stock_min above the article's current stock_max
    // must surface as a clean 400, not a raw 500.
    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ stock_min: 999999 }) }),
      { params: Promise.resolve({ co_art: testArticle.co_art }) },
    );
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBeTruthy();

    const unchanged = await getArticleSnapshot(testArticle.co_art);
    expect(unchanged.stock_min).toBe(testArticle.stock_min);
  });

  test.each([
    'co_lin', 'anulado', 'tipo_imp', 'margen_min', 'co_art', '__proto__', '',
  ])('rejects a non-whitelisted field: %p', async (field) => {
    const db = getDb();
    const user = db.insert(users).values({
      email: `editor-${encodeURIComponent(field)}@x.com`, name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ [field]: 'HACKED' }) }),
      { params: Promise.resolve({ co_art: testArticle.co_art }) },
    );
    expect(response.status).toBe(400);

    const unchanged = await getArticleSnapshot(testArticle.co_art);
    expect(unchanged.art_des).toBe(testArticle.art_des);
  });

  test('user without the inventory module gets 403', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'noaccess2@x.com', name: 'No Access', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'No Access' });

    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ art_des: 'Should Not Apply' }) }),
      { params: Promise.resolve({ co_art: testArticle.co_art }) },
    );
    expect(response.status).toBe(403);
  });

  test('unknown article returns 404', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin3@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ art_des: 'Nope' }) }),
      { params: Promise.resolve({ co_art: 'NONEXISTENT_CODE_XYZ' }) },
    );
    expect(response.status).toBe(404);
  });

  test('rejects a non-numeric value for a numeric field', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin4@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await patchItem(
      buildRequest(token, { method: 'PATCH', body: JSON.stringify({ stock_min: 'not-a-number' }) }),
      { params: Promise.resolve({ co_art: testArticle.co_art }) },
    );
    expect(response.status).toBe(400);
  });
});
