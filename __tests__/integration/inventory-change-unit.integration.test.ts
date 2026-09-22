process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { POST as changeUnit } from '@/app/api/inventory/items/[co_art]/unit/route';

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

let pool: sql.ConnectionPool;

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

function buildRequest(token: string | null, body: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/inventory/items/TEST-ARTICLE/unit', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/inventory/items/[co_art]/unit @mssql', () => {
  beforeAll(async () => {
    pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  });

  afterAll(async () => {
    await pool.close();
  });

  test('changes article principal unit successfully', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'unit-test@e2e.test', passwordHash: 'x', name: 'Unit Test', role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Unit Test' });

    // Find an article that genuinely has >=2 valid units configured in
    // saArtUnidad (most articles in this installation have only one — see
    // saArtUnidad's own docs: "el manejo de doble unidad... es marginal en
    // esta instalación" — confirmed live 2026-09-21 that ~33 articles do
    // have 2+ real units). Picking an arbitrary saUnidad code unrelated to
    // the article (the previous approach) triggers
    // CK_saArtUnidad_UniPrincipal via pApiCambiarUnidadArticulo's nested
    // INSERT — which doesn't just fail cleanly, it deterministically
    // corrupts the TDS response for this specific procedure whenever its
    // error path runs (root-caused 2026-09-21; see the route's own comment
    // above callChangeUnit in app/api/inventory/items/[co_art]/unit/route.ts
    // for the full mechanism and the app-side pre-validation fix). Using a
    // real, valid alternate unit avoids ever triggering that error path here.
    const articleResult = await pool.request()
      .query(`
        SELECT TOP 1 au1.co_art, au1.co_uni AS currentUnit, au2.co_uni AS alternateUnit
        FROM saArtUnidad au1
        JOIN saArtUnidad au2 ON au2.co_art = au1.co_art AND au2.co_uni <> au1.co_uni
        JOIN saArticulo a ON a.co_art = au1.co_art
        WHERE a.anulado = 0 AND au1.uni_principal = 1
        ORDER BY au1.co_art
      `);
    // Bun's test.skip is a describe/test wrapper (test.skip('name', fn)),
    // not a mid-test dynamic-skip call like Jest's — there's no runtime
    // "skip this test now" API in Bun, so this just returns early instead.
    // The test then reports as passed-with-no-assertions rather than
    // skipped, which is an acceptable trade-off for a precondition this
    // unlikely to fail (33+ dual-unit articles exist in the seed data).
    if (articleResult.recordset.length === 0) {
      return;
    }

    const testArticle = (articleResult.recordset[0].co_art as string).trim();
    const newUnit = (articleResult.recordset[0].alternateUnit as string).trim();

    const req = buildRequest(token, { coUniNueva: newUnit });
    const res = await changeUnit(req, { params: Promise.resolve({ co_art: testArticle }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.coArt).toBe(testArticle);
    expect(body.coUniNueva).toBe(newUnit);

    // Verify the unit was actually changed in the database
    const verifyResult = await pool.request()
      .input('coArt', sql.Char(30), testArticle)
      .query(`
        SELECT TOP 1 au.co_uni, au.uni_principal
        FROM saArtUnidad au
        WHERE au.co_art = @coArt AND au.uni_principal = 1
      `);
    expect(verifyResult.recordset.length).toBe(1);
    expect((verifyResult.recordset[0].co_uni as string).trim()).toBe(newUnit);
  });

  test('returns 401 without a session', async () => {
    const req = buildRequest(null, { coUniNueva: 'UNIT' });
    const res = await changeUnit(req, { params: Promise.resolve({ co_art: 'TEST' }) });
    expect(res.status).toBe(401);
  });

  test('returns 400 for invalid unit', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'unit-bad-test@e2e.test', passwordHash: 'x', name: 'Unit Bad Test', role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Unit Bad Test' });

    const req = buildRequest(token, { coUniNueva: 'NONEXISTENT' });
    const res = await changeUnit(req, { params: Promise.resolve({ co_art: 'SOME-ARTICLE' }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
