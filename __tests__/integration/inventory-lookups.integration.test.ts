process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getLookups } from '@/app/api/inventory/lookups/route';
import { GET as getNextCode } from '@/app/api/inventory/items/next-code/route';

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

async function buildAuthedRequest(url: string): Promise<NextRequest> {
  resetSqliteDb();
  const db = getDb();
  const user = db.insert(users).values({
    email: 'lookups-test@e2e.test', passwordHash: 'x', name: 'Lookups Test', role: 'user',
    createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
  const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Lookups Test' });
  return new NextRequest(url, { headers: { Cookie: `session=${token}` } });
}

describe('GET /api/inventory/lookups @mssql', () => {
  afterAll(() => resetSqliteDb());

  test('returns non-empty lineas, categorias, unidades, and exactly 6 production motivos', async () => {
    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.lineas.length).toBeGreaterThan(0);
    expect(data.categorias.length).toBeGreaterThan(0);
    expect(data.unidades.length).toBeGreaterThan(0);
    expect(data.motivos).toHaveLength(6);
    const codes = data.motivos.map((m: { coTipo: string }) => m.coTipo).sort();
    expect(codes).toEqual(['E00001', 'E00002', 'S00001', 'S00002', 'S00003', 'S00004']);
  });

  test('every subLinea references a real linea code present in lineas', async () => {
    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    const data = await res.json();
    const lineaCodes = new Set(data.lineas.map((l: { coLin: string }) => l.coLin));
    for (const s of data.sublineas) {
      expect(lineaCodes.has(s.coLin)).toBe(true);
    }
  });

  test('returns 401 without a session', async () => {
    const req = new NextRequest('http://localhost:3000/api/inventory/lookups');
    const res = await getLookups(req);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inventory/items/next-code @mssql', () => {
  afterAll(() => resetSqliteDb());

  test('returns a 7-digit numeric code one past the current max', async () => {
    const pool = await new sql.ConnectionPool({
      server: process.env.DB_SERVER!, port: parseInt(process.env.DB_PORT ?? '1433'),
      database: process.env.DB_NAME!, user: process.env.DB_USER!, password: process.env.DB_PASSWORD!,
      options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false' },
    }).connect();
    const maxResult = await pool.request()
      .query(`SELECT MAX(TRY_CAST(co_art AS BIGINT)) AS maxCode FROM saArticulo WHERE TRY_CAST(co_art AS BIGINT) IS NOT NULL`);
    const expected = String(Number(maxResult.recordset[0].maxCode) + 1).padStart(7, '0');
    await pool.close();

    const req = await buildAuthedRequest('http://localhost:3000/api/inventory/items/next-code');
    const res = await getNextCode(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nextCode).toBe(expected);
  });
});
