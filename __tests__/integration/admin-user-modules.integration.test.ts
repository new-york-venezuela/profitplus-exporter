process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { PUT } from '@/app/api/admin/users/[id]/modules/route';
import { GET as getUsers } from '@/app/api/admin/users/route';

function buildRequest(token: string | null, init: { method: string; body?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/test', {
    method: init.method,
    body: init.body,
    headers,
  });
}

function resetDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

describe('PUT /api/admin/users/:id/modules', () => {
  beforeEach(() => {
    resetDb();
  });

  test('admin can grant the inventory module to a user', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(200);

    const grants = db.select().from(userModules).where(eq(userModules.userId, target.id)).all();
    expect(grants.map(g => g.module)).toEqual(['inventory']);
  });

  test('non-admin gets 403', async () => {
    const db = getDb();
    const nonAdmin = db.insert(users).values({
      email: 'user@x.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(nonAdmin.id), role: 'user', name: 'User' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(nonAdmin.id) }) });
    expect(response.status).toBe(403);
  });

  test('no session cookie gets 401', async () => {
    const db = getDb();
    const target = db.insert(users).values({
      email: 'target3@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const request = buildRequest(null, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['inventory'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(401);
  });

  test('PUT with an empty array revokes all modules', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target2@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: target.id, module: 'inventory' }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: [] }),
    });

    await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });

    const grants = db.select().from(userModules).where(eq(userModules.userId, target.id)).all();
    expect(grants).toHaveLength(0);
  });

  test('rejects an unknown module name', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin4@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const target = db.insert(users).values({
      email: 'target4@x.com', name: 'Target', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PUT',
      body: JSON.stringify({ modules: ['not-a-real-module'] }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: String(target.id) }) });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    resetDb();
  });

  test('includes each user\'s modules array', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin3@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(userModules).values({ userId: admin.id, module: 'inventory' }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'GET' });

    const response = await getUsers(request);
    const body = await response.json() as Array<{ id: number; modules: string[] }>;
    const row = body.find(u => u.id === admin.id);
    expect(row?.modules).toEqual(['inventory']);
  });
});
