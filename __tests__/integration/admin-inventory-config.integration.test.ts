process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getWarehouses, POST as postWarehouse } from '@/app/api/admin/inventory-warehouses/route';
import { PATCH as patchWarehouse, DELETE as deleteWarehouse } from '@/app/api/admin/inventory-warehouses/[id]/route';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/admin/inventory-settings/route';

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
  db.delete(inventoryWarehouses).run();
  db.delete(users).run();
}

describe('inventory-warehouses admin API', () => {
  beforeEach(() => {
    resetDb();
  });

  test('admin can add a warehouse', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, {
      method: 'POST',
      body: JSON.stringify({ coAlma: '14', label: 'Materia Prima' }),
    });
    const response = await postWarehouse(request);
    expect(response.status).toBe(201);

    const rows = db.select().from(inventoryWarehouses).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coAlma).toBe('14');
    expect(rows[0]!.active).toBe(true);
  });

  test('non-admin cannot add a warehouse', async () => {
    const db = getDb();
    const user = db.insert(users).values({
      email: 'user@x.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(user.id), role: 'user', name: 'User' });

    const request = buildRequest(token, {
      method: 'POST',
      body: JSON.stringify({ coAlma: '14', label: 'Materia Prima' }),
    });
    const response = await postWarehouse(request);
    expect(response.status).toBe(403);
  });

  test('GET lists all configured warehouses', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin1b@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    db.insert(inventoryWarehouses).values({ coAlma: '13', label: 'Insumos', active: true }).run();

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'GET' });
    const response = await getWarehouses(request);
    const body = await response.json() as Array<{ coAlma: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.coAlma).toBe('13');
  });

  test('admin can deactivate a warehouse via PATCH', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin2@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const wh = db.insert(inventoryWarehouses).values({
      coAlma: '13', label: 'Insumos', active: true,
    }).returning({ id: inventoryWarehouses.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    const response = await patchWarehouse(request, { params: Promise.resolve({ id: String(wh.id) }) });
    expect(response.status).toBe(200);

    const updated = db.select().from(inventoryWarehouses).all();
    expect(updated[0]!.active).toBe(false);
  });

  test('admin can delete a warehouse', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin3@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const wh = db.insert(inventoryWarehouses).values({
      coAlma: '99', label: 'Temporal', active: true,
    }).returning({ id: inventoryWarehouses.id }).get()!;

    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });
    const request = buildRequest(token, { method: 'DELETE' });
    const response = await deleteWarehouse(request, { params: Promise.resolve({ id: String(wh.id) }) });
    expect(response.status).toBe(200);

    const rows = db.select().from(inventoryWarehouses).all();
    expect(rows).toHaveLength(0);
  });
});

describe('inventory-settings admin API', () => {
  test('GET returns the seeded defaults', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin4@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, { method: 'GET' });
    const response = await getSettings(request);
    const body = await response.json() as { rollingWindowDays: number; daysOfStockThreshold: number };
    expect(body.rollingWindowDays).toBe(60);
    expect(body.daysOfStockThreshold).toBe(7);
  });

  test('PATCH updates the threshold', async () => {
    const db = getDb();
    const admin = db.insert(users).values({
      email: 'admin5@x.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: users.id }).get()!;
    const token = await signToken({ sub: String(admin.id), role: 'admin', name: 'Admin' });

    const request = buildRequest(token, {
      method: 'PATCH',
      body: JSON.stringify({ daysOfStockThreshold: 14 }),
    });
    await patchSettings(request);

    const rows = db.select().from(inventorySettings).all();
    expect(rows[0]!.daysOfStockThreshold).toBe(14);

    // restore the default so later tests in this file aren't affected
    db.update(inventorySettings).set({ daysOfStockThreshold: 7 }).run();
  });
});
