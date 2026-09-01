process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getHistory } from '@/app/api/inventory/adjustments/history/route';

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

function buildRequest(token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/inventory/adjustments/history', { headers });
}

describe('GET /api/inventory/adjustments/history @mssql', () => {
  beforeAll(async () => {
    pool = await new sql.ConnectionPool(buildTestConfig()).connect();
  });

  afterAll(async () => {
    await pool.close();
  });

  test('returns all adjustment types (app-created and external), newest first', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'hist-test@e2e.test', passwordHash: 'x', name: 'Hist Test', role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Hist Test' });

    const req = buildRequest(token);
    const res = await getHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const row of body) {
      expect(row).toHaveProperty('coTipo');
      expect(row).toHaveProperty('desTipo');
      expect(typeof row.desTipo).toBe('string');
    }
    for (let i = 1; i < body.length; i++) {
      expect(new Date(body[i - 1].fecha).getTime()).toBeGreaterThanOrEqual(new Date(body[i].fecha).getTime());
    }
  });

  test('returns 401 without a session', async () => {
    const req = buildRequest(null);
    const res = await getHistory(req);
    expect(res.status).toBe(401);
  });
});
