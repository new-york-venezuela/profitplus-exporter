// Route-level access outcomes for /api/pricing/*. Uses its OWN temp SQLite (never data/exporter.db)
// and needs no ERP: every assertion is an auth outcome decided before the pool is touched.
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
const sqliteDir = mkdtempSync(path.join(tmpdir(), 'pricing-routes-'));
mkdirSync(path.join(sqliteDir, 'data'));
process.env.SQLITE_PATH = sqliteDir; // must be set before @/lib/db/sqlite is first imported

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { NextRequest } from 'next/server';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const { getDb } = await import('@/lib/db/sqlite');
const { users, userModules } = await import('@/lib/db/schema');
const { signToken } = await import('@/lib/auth/session');
const segmentsRoute = await import('@/app/api/pricing/segments/route');
const segmentRoute = await import('@/app/api/pricing/segments/[tipCli]/route');
const assignmentsRoute = await import('@/app/api/pricing/assignments/route');
const customersRoute = await import('@/app/api/pricing/customers/route');
const filtersRoute = await import('@/app/api/pricing/customer-filters/route');

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
  return new NextRequest('http://localhost:3000/api/pricing/x', {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const tip = (t: string) => ({ params: Promise.resolve({ tipCli: t }) });

let viewer: string;
let nobody: string;

beforeAll(async () => {
  migrate(getDb(), { migrationsFolder: './migrations/sqlite' });
  viewer = await makeUser('viewer@x.com', ['pricing_view']);
  nobody = await makeUser('nobody@x.com', []);
});
afterAll(() => rmSync(sqliteDir, { recursive: true, force: true }));

describe('/api/pricing access', () => {
  test('401 without a session', async () => {
    expect((await segmentsRoute.GET(req(null, 'GET'))).status).toBe(401);
    expect((await segmentsRoute.POST(req(null, 'POST', {}))).status).toBe(401);
    expect((await segmentRoute.PATCH(req(null, 'PATCH', {}), tip('000001'))).status).toBe(401);
    expect((await assignmentsRoute.POST(req(null, 'POST', {}))).status).toBe(401);
  });

  test('pricing_view user gets 403 on every write route', async () => {
    expect((await segmentsRoute.POST(req(viewer, 'POST', { kind: 'group', desTipo: 'x', coPrecio: '01' }))).status).toBe(403);
    expect((await segmentRoute.PATCH(req(viewer, 'PATCH', { desTipo: 'x', validador: '0x01' }), tip('000001'))).status).toBe(403);
    expect((await assignmentsRoute.POST(req(viewer, 'POST', { customerCodes: ['C1'], targetTipCli: '000001' }))).status).toBe(403);
  });

  test('user without a pricing grant gets 403 on every read route', async () => {
    expect((await segmentsRoute.GET(req(nobody, 'GET'))).status).toBe(403);
    expect((await customersRoute.GET(req(nobody, 'GET'))).status).toBe(403);
    expect((await filtersRoute.GET(req(nobody, 'GET'))).status).toBe(403);
  });
});
