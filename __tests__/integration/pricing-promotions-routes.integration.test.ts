// Route-level access outcomes for /api/pricing/promotions*. Own temp SQLite (never data/exporter.db), no ERP needed:
// every assertion is decided before the pool is touched.
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
const sqliteDir = mkdtempSync(path.join(tmpdir(), 'pricing-promo-routes-'));
mkdirSync(path.join(sqliteDir, 'data'));
process.env.SQLITE_PATH = sqliteDir; // must be set before @/lib/db/sqlite is first imported

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { NextRequest } from 'next/server';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const { getDb } = await import('@/lib/db/sqlite');
const { users, userModules } = await import('@/lib/db/schema');
const { signToken } = await import('@/lib/auth/session');
const listRoute = await import('@/app/api/pricing/promotions/route');
const previewRoute = await import('@/app/api/pricing/promotions/preview/route');
const idRoute = await import('@/app/api/pricing/promotions/[id]/route');
const retryRoute = await import('@/app/api/pricing/promotions/[id]/retry/route');

async function makeUser(email: string, modules: string[]) {
  const db = getDb();
  const u = db.insert(users).values({ email, name: email, passwordHash: 'x', role: 'user', createdAt: Date.now() })
    .returning({ id: users.id }).get()!;
  for (const m of modules) db.insert(userModules).values({ userId: u.id, module: m as 'pricing_view' }).run();
  return signToken({ sub: String(u.id), role: 'user', name: email });
}

function req(token: string | null, method: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/pricing/promotions', {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const id = (v: string) => ({ params: Promise.resolve({ id: v }) });

let viewer: string;
let editor: string;
let nobody: string;

beforeAll(async () => {
  migrate(getDb(), { migrationsFolder: './migrations/sqlite' });
  viewer = await makeUser('viewer@x.com', ['pricing_view']);
  nobody = await makeUser('nobody@x.com', []);
  editor = await makeUser('editor@x.com', ['pricing_edit']);
});
afterAll(() => rmSync(sqliteDir, { recursive: true, force: true }));

describe('/api/pricing/promotions access', () => {
  test('401 without a session', async () => {
    expect((await listRoute.GET(req(null, 'GET'))).status).toBe(401);
    expect((await listRoute.POST(req(null, 'POST', {}))).status).toBe(401);
    expect((await previewRoute.POST(req(null, 'POST', {}))).status).toBe(401);
    expect((await idRoute.GET(req(null, 'GET'), id('1'))).status).toBe(401);
    expect((await idRoute.PATCH(req(null, 'PATCH', {}), id('1'))).status).toBe(401);
    expect((await retryRoute.POST(req(null, 'POST'), id('1'))).status).toBe(401);
  });

  test('pricing_view user gets 403 on every write route', async () => {
    expect((await listRoute.POST(req(viewer, 'POST', {}))).status).toBe(403);
    expect((await idRoute.PATCH(req(viewer, 'PATCH', { action: 'cancel' }), id('1'))).status).toBe(403);
    expect((await retryRoute.POST(req(viewer, 'POST'), id('1'))).status).toBe(403);
  });

  test('user without a pricing grant gets 403 on every read route', async () => {
    expect((await listRoute.GET(req(nobody, 'GET'))).status).toBe(403);
    expect((await idRoute.GET(req(nobody, 'GET'), id('1'))).status).toBe(403);
    expect((await previewRoute.POST(req(nobody, 'POST', {}))).status).toBe(403);
  });

  test('a pricing_edit-only user passes the view gate on GETs (bad id reaches validation, not 403)', async () => {
    expect((await idRoute.GET(req(editor, 'GET'), id('abc'))).status).toBe(400);
  });

  test('a bad id is 400 for an authorised user', async () => {
    for (const bad of ['0', '-1', '1.5', 'abc', '12abc']) {
      expect((await idRoute.GET(req(viewer, 'GET'), id(bad))).status).toBe(400);
      expect((await idRoute.PATCH(req(editor, 'PATCH', { action: 'cancel' }), id(bad))).status).toBe(400);
      expect((await retryRoute.POST(req(editor, 'POST'), id(bad))).status).toBe(400);
    }
  });

  test('an invalid body is 400 before any ERP access', async () => {
    expect((await listRoute.POST(req(editor, 'POST', { kind: 'nope' }))).status).toBe(400);
    expect((await previewRoute.POST(req(viewer, 'POST', { kind: 'nope' }))).status).toBe(400);
    expect((await idRoute.PATCH(req(editor, 'PATCH', { action: 'nuke' }), id('1'))).status).toBe(400);
  });
});
