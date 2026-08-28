process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, invoiceReminderSettings } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/admin/config-cobranza/route';

function buildRequest(token: string | null, init: { method: string; body?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest('http://localhost:3000/api/admin/config-cobranza', { method: init.method, body: init.body, headers });
}

function resetDb() {
  const db = getDb();
  db.delete(invoiceReminderSettings).run();
  db.delete(users).run();
  db.insert(invoiceReminderSettings).values({ thresholdDays: 3 }).run();
}

describe('admin config-cobranza API', () => {
  beforeEach(() => {
    resetDb();
  });

  test('no session cookie gets 401 on GET', async () => {
    const response = await getSettings(buildRequest(null, { method: 'GET' }));
    expect(response.status).toBe(401);
  });

  test('non-admin gets 403 on GET', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user-cobranza@x.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const response = await getSettings(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(403);
  });

  test('admin can read the current threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await getSettings(buildRequest(token, { method: 'GET' }));
    expect(response.status).toBe(200);
    const body = await response.json() as { thresholdDays: number };
    expect(body.thresholdDays).toBe(3);
  });

  test('admin can update the threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza2@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const patchResponse = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 5 }),
    }));
    expect(patchResponse.status).toBe(200);

    const row = db.select().from(invoiceReminderSettings).get();
    expect(row?.thresholdDays).toBe(5);
  });

  test('non-admin gets 403 on PATCH', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user-cobranza2@x.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const response = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 5 }),
    }));
    expect(response.status).toBe(403);
  });

  test('rejects a non-positive thresholdDays', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin-cobranza3@x.com', name: 'Admin', passwordHash: 'x', role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const response = await patchSettings(buildRequest(token, {
      method: 'PATCH', body: JSON.stringify({ thresholdDays: 0 }),
    }));
    expect(response.status).toBe(400);
  });
});
