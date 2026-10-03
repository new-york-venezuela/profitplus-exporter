// Route-level access outcomes for /api/pricing/health and /api/pricing/alert-settings. Own temp SQLite (never
// data/exporter.db); every assertion is decided before the ERP pool is touched.
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
const sqliteDir = mkdtempSync(path.join(tmpdir(), 'pricing-health-routes-'));
mkdirSync(path.join(sqliteDir, 'data'));
process.env.SQLITE_PATH = sqliteDir; // must be set before @/lib/db/sqlite is first imported

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { NextRequest } from 'next/server';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const { getDb } = await import('@/lib/db/sqlite');
const { users, userModules } = await import('@/lib/db/schema');
const { signToken } = await import('@/lib/auth/session');
const healthRoute = await import('@/app/api/pricing/health/route');
const settingsRoute = await import('@/app/api/pricing/alert-settings/route');

async function makeUser(email: string, role: 'user' | 'admin', modules: string[]) {
  const db = getDb();
  const u = db.insert(users).values({ email, name: email, passwordHash: 'x', role, createdAt: Date.now() })
    .returning({ id: users.id }).get()!;
  for (const m of modules) db.insert(userModules).values({ userId: u.id, module: m as 'pricing_view' }).run();
  return signToken({ sub: String(u.id), role, name: email });
}

function req(token: string | null, method: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Cookie = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/pricing/alert-settings', {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const valid = { enabled: true, daysAhead: 10, recipients: ['Ops@X.com'] };
let viewer: string;
let editor: string;
let nobody: string;
let admin: string;

beforeAll(async () => {
  migrate(getDb(), { migrationsFolder: './migrations/sqlite' });
  viewer = await makeUser('viewer@x.com', 'user', ['pricing_view']);
  editor = await makeUser('editor@x.com', 'user', ['pricing_edit']);
  nobody = await makeUser('nobody@x.com', 'user', []);
  admin = await makeUser('admin@x.com', 'admin', []);
});
afterAll(() => rmSync(sqliteDir, { recursive: true, force: true }));

describe('/api/pricing/health access', () => {
  test('401 without a session, 403 without a pricing grant', async () => {
    expect((await healthRoute.GET(req(null, 'GET'))).status).toBe(401);
    expect((await healthRoute.GET(req(nobody, 'GET'))).status).toBe(403);
  });
});

describe('/api/pricing/alert-settings is admin-only', () => {
  test('401 without a session', async () => {
    expect((await settingsRoute.GET(req(null, 'GET'))).status).toBe(401);
    expect((await settingsRoute.PUT(req(null, 'PUT', valid))).status).toBe(401);
  });

  test('403 for no grant, pricing_view and even pricing_edit, on read and write', async () => {
    for (const t of [nobody, viewer, editor]) {
      expect((await settingsRoute.GET(req(t, 'GET'))).status).toBe(403);
      expect((await settingsRoute.PUT(req(t, 'PUT', valid))).status).toBe(403);
    }
  });

  test('a forbidden write changes nothing', async () => {
    await settingsRoute.PUT(req(editor, 'PUT', valid));
    const body = await (await settingsRoute.GET(req(admin, 'GET'))).json();
    expect(body.settings).toEqual({ enabled: true, daysAhead: 7, recipients: null });
  });

  test('admin reads defaults, rejects invalid bodies, saves and reads back normalised settings', async () => {
    const get = await settingsRoute.GET(req(admin, 'GET'));
    expect(get.status).toBe(200);
    expect((await get.json()).settings).toEqual({ enabled: true, daysAhead: 7, recipients: null });

    expect((await settingsRoute.PUT(req(admin, 'PUT', { ...valid, daysAhead: 0 }))).status).toBe(400);
    expect((await settingsRoute.PUT(req(admin, 'PUT', { ...valid, recipients: ['nope'] }))).status).toBe(400);
    expect((await settingsRoute.PUT(req(admin, 'PUT'))).status).toBe(400);

    const put = await settingsRoute.PUT(req(admin, 'PUT', valid));
    expect(put.status).toBe(200);
    expect((await put.json()).settings).toEqual({ enabled: true, daysAhead: 10, recipients: ['ops@x.com'] });
    expect((await (await settingsRoute.GET(req(admin, 'GET'))).json()).settings.daysAhead).toBe(10);
  });
});
