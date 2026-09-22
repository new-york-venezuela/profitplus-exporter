process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import sql from 'mssql';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getDashboard } from '@/app/api/inventory/dashboard/route';

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

const WAREHOUSE = '000015';
let pool: sql.ConnectionPool;
let testArticle: { co_art: string; sold60: number };
let stockSnapshot: number;
// The rolling window used both to find fixture data below AND to configure
// inventorySettings for every test in this file — computed from the test
// data's own most recent invoice date rather than hardcoded to 60, so this
// suite keeps working as wall-clock time moves further past this static
// ERP fixture's fixed date range (confirmed live 2026-09-21: the fixture's
// newest invoice is from 2026-07-10, already outside a real "last 60 days
// from today" window). A fixed 60 would eventually make "recent sales"
// permanently empty regardless of the code under test.
let rollingWindowDays: number;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(inventoryWarehouses).run();
  db.delete(inventorySettings).run();
  db.delete(users).run();
}

function buildRequest(token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/inventory/dashboard', { headers });
}

async function getStock(coArt: string, coAlma: string): Promise<number> {
  const result = await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .query(`SELECT stock FROM saStockAlmacen WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
  return result.recordset[0]?.stock ?? 0;
}

async function setStock(coArt: string, coAlma: string, value: number): Promise<void> {
  await pool.request()
    .input('coArt', sql.Char(30), coArt)
    .input('coAlma', sql.Char(6), coAlma)
    .input('value', sql.Decimal(18, 5), value)
    .query(`UPDATE saStockAlmacen SET stock = @value WHERE co_art = @coArt AND co_alma = @coAlma AND tipo = 'ACT'`);
}

beforeAll(async () => {
  resetSqliteDb();
  pool = await new sql.ConnectionPool(buildTestConfig()).connect();

  // The production route (app/api/inventory/dashboard/route.ts) computes
  // its "since" cutoff from real wall-clock Date.now() — it cannot be told
  // to anchor on this fixture's fixed date range instead, nor should it be
  // (that's correct behavior for a real deployment). So rollingWindowDays
  // here is set wide enough to reach from real "now" all the way back past
  // this fixture's most recent invoice date, rather than the realistic-
  // looking but fixture-incompatible default of 60. This keeps the
  // avgDailySales/daysOfStock math meaningful (60 real days' worth of the
  // fixture's actual sales, scaled over however many days that now spans)
  // while staying correct as more real time passes.
  const maxDateResult = await pool.request().query(`SELECT MAX(fec_emis) AS maxFecha FROM saFacturaVenta WHERE anulado = 0`);
  const maxFecha = maxDateResult.recordset[0]?.maxFecha as Date | null;
  if (!maxFecha) {
    throw new Error('No invoices found in the test database at all — cannot anchor the rolling window');
  }
  const daysSinceFixtureMax = Math.ceil((Date.now() - maxFecha.getTime()) / 86_400_000);
  rollingWindowDays = daysSinceFixtureMax + 60;

  // Pick a real article with genuine sales history in the last 60 days of
  // this fixture's own data (ending at its latest invoice date), so
  // avgDailySales reflects an actual, non-fabricated consumption rate. Only
  // its stock value is temporarily overridden below. The 60-day lookback
  // here (fixture-relative) is intentionally independent of
  // rollingWindowDays (real-time-relative, used by the route under test).
  const result = await pool.request()
    .input('coAlma', sql.Char(6), WAREHOUSE)
    .input('sinceDate', sql.DateTime, new Date(maxFecha.getTime() - 60 * 86_400_000))
    .query(`
      SELECT TOP 1 s.co_art,
        (SELECT SUM(fvr.total_art) FROM saFacturaVentaReng fvr
         JOIN saFacturaVenta fv ON fv.doc_num = fvr.doc_num
         WHERE fv.anulado = 0 AND fvr.co_art = s.co_art AND fvr.co_alma = @coAlma
           AND fv.fec_emis > @sinceDate) AS sold60
      FROM saStockAlmacen s
      WHERE s.co_alma = @coAlma AND s.tipo = 'ACT'
        AND EXISTS (
          SELECT 1 FROM saFacturaVentaReng fvr JOIN saFacturaVenta fv ON fv.doc_num = fvr.doc_num
          WHERE fv.anulado = 0 AND fvr.co_art = s.co_art AND fvr.co_alma = @coAlma
            AND fv.fec_emis > @sinceDate
        )
      ORDER BY sold60 DESC
    `);
  if (result.recordset.length === 0) {
    throw new Error(`No article with recent sales found in warehouse ${WAREHOUSE} for test setup`);
  }
  testArticle = {
    co_art: (result.recordset[0].co_art as string).trim(),
    sold60: Number(result.recordset[0].sold60),
  };
  stockSnapshot = await getStock(testArticle.co_art, WAREHOUSE);

  const db = getDb();
  db.insert(inventoryWarehouses).values({ coAlma: WAREHOUSE, label: 'Oficina', active: true })
    .onConflictDoNothing().run();
  db.insert(inventorySettings).values({ rollingWindowDays, daysOfStockThreshold: 7 }).run();
});

afterEach(async () => {
  await setStock(testArticle.co_art, WAREHOUSE, stockSnapshot);
});

afterAll(async () => {
  // This file's beforeAll deletes the shared inventory_settings row and
  // reinserts one with a fixture-relative rollingWindowDays (see that
  // comment above) — restore the pristine seeded defaults so later test
  // files in the same run (e.g. admin-inventory-config.integration.test.ts,
  // which asserts the seeded 60/7 defaults) aren't left reading this file's
  // leftover value. A prior version of this file lacked this restore and
  // corrupted admin-inventory-config's "GET returns the seeded defaults"
  // test whenever this file ran first in the same process.
  const db = getDb();
  db.delete(inventorySettings).run();
  db.insert(inventorySettings).values({ rollingWindowDays: 60, daysOfStockThreshold: 7 }).run();
  db.delete(inventoryWarehouses).where(eq(inventoryWarehouses.coAlma, WAREHOUSE)).run();

  if (pool?.connected) await pool.close();
});

describe('GET /api/inventory/dashboard', () => {
  test('no session cookie gets 401', async () => {
    const response = await getDashboard(buildRequest(null));
    expect(response.status).toBe(401);
  });

  test('user without the inventory module gets 403', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'noaccess-dash@x.com', name: 'No Access', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'No Access' });

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(403);
  });

  test('admin can view the dashboard without an explicit module grant', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-dash@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(200);
  });

  test('flags an item whose stock/avgDailySales is under the threshold', async () => {
    const avgDailySales = testArticle.sold60 / rollingWindowDays;
    // Set stock to exactly 3 days of coverage — comfortably under the
    // default 7-day threshold, so this item must appear in the result.
    const lowStock = Math.max(1, Math.round(avgDailySales * 3));
    await setStock(testArticle.co_art, WAREHOUSE, lowStock);

    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-dash1@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ coArt: string; coAlma: string; daysOfStock: number }> };

    const flagged = body.items.find(i => i.coArt === testArticle.co_art && i.coAlma.trim() === WAREHOUSE.trim());
    expect(flagged).toBeDefined();
    expect(flagged!.daysOfStock).toBeLessThan(7);
    // Loose precision (1 decimal place, not 5): the route recomputes its
    // own sinceDate from a fresh Date.now() at request time, while
    // avgDailySales here was computed once in beforeAll — any wall-clock
    // drift between the two (even sub-second, and definitely across
    // re-runs on different days) shifts which invoices the route's own
    // "recent sales" query sums, which this assertion isn't meant to
    // verify to sub-day precision. ~3 days of stock coverage landing
    // within a tenth of a day of the expected value is precise enough to
    // confirm the daysOfStock formula (stock / avgDailySales) is correct.
    expect(flagged!.daysOfStock).toBeCloseTo(lowStock / avgDailySales, 1);
  });

  test('does not flag an item whose stock is comfortably above the threshold', async () => {
    const avgDailySales = testArticle.sold60 / rollingWindowDays;
    const highStock = Math.round(avgDailySales * 365);
    await setStock(testArticle.co_art, WAREHOUSE, highStock);

    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-dash2@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ coArt: string; coAlma: string }> };

    const flagged = body.items.find(i => i.coArt === testArticle.co_art && i.coAlma.trim() === WAREHOUSE.trim());
    expect(flagged).toBeUndefined();
  });

  test('respects the active warehouse allowlist when configured', async () => {
    // A non-empty allowlist that excludes WAREHOUSE (rather than deactivating
    // the only configured row, which per the established empty-allowlist-means-
    // all-warehouses fallback would remove the restriction entirely, not narrow it).
    const db = getDb();
    db.insert(inventoryWarehouses).values({ coAlma: '999999', label: 'Otro almacén', active: true }).run();
    db.update(inventoryWarehouses).set({ active: false }).where(eq(inventoryWarehouses.coAlma, WAREHOUSE)).run();

    const user = db.insert(users).values({
      email: 'editor-dash3@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const avgDailySales = testArticle.sold60 / rollingWindowDays;
    await setStock(testArticle.co_art, WAREHOUSE, Math.max(1, Math.round(avgDailySales)));

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ coArt: string; coAlma: string }> };
    const flagged = body.items.find(i => i.coArt === testArticle.co_art && i.coAlma.trim() === WAREHOUSE.trim());
    expect(flagged).toBeUndefined();

    db.delete(inventoryWarehouses).where(eq(inventoryWarehouses.coAlma, '999999')).run();
    db.update(inventoryWarehouses).set({ active: true }).where(eq(inventoryWarehouses.coAlma, WAREHOUSE)).run();
  });

  test('returns the effective rollingWindowDays and daysOfStockThreshold', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'editor-dash4@x.com', name: 'Editor', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: user.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'Editor' });

    const response = await getDashboard(buildRequest(token));
    expect(response.status).toBe(200);
    const body = await response.json() as { rollingWindowDays: number; daysOfStockThreshold: number };
    expect(body.rollingWindowDays).toBe(rollingWindowDays);
    expect(body.daysOfStockThreshold).toBe(7);
  });
});
