process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { hasInventoryAccess, getSessionFromRequest } from '@/lib/inventory/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => {
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterEach(() => {
  sqlite.exec('DELETE FROM user_modules');
  sqlite.exec('DELETE FROM users');
});

describe('hasInventoryAccess', () => {
  test('admin always has access, even with no module grant', async () => {
    const admin = db.insert(schema.users).values({
      email: 'admin@example.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    const result = await hasInventoryAccess(db, String(admin!.id), 'admin');
    expect(result).toBe(true);
  });

  test('regular user without a grant has no access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user@example.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    const result = await hasInventoryAccess(db, String(user!.id), 'user');
    expect(result).toBe(false);
  });

  test('regular user with an inventory grant has access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user2@example.com', name: 'User Two', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({
      userId: user!.id, module: 'inventory',
    }).run();

    const result = await hasInventoryAccess(db, String(user!.id), 'user');
    expect(result).toBe(true);
  });
});

describe('getSessionFromRequest', () => {
  test('reads and verifies a valid session cookie', async () => {
    const token = await signToken({ sub: '7', role: 'admin', name: 'Test Admin' });
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: { Cookie: `session=${token}` },
    });

    const session = await getSessionFromRequest(request);
    expect(session?.sub).toBe('7');
    expect(session?.role).toBe('admin');
  });

  test('returns null when there is no session cookie', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });

  test('returns null for a garbage/invalid token', async () => {
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: { Cookie: 'session=not-a-real-jwt' },
    });
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });
});
