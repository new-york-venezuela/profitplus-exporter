process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import { hasGeoAccess } from '@/lib/geo/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => { migrate(db, { migrationsFolder: './migrations/sqlite' }); });
afterEach(() => { sqlite.exec('DELETE FROM user_modules'); sqlite.exec('DELETE FROM users'); });

function addUser(role: 'user' | 'admin') {
  return db.insert(schema.users).values({
    email: `${role}@example.com`, name: role, passwordHash: 'x', role, createdAt: Date.now(),
  }).returning({ id: schema.users.id }).get()!.id;
}

describe('hasGeoAccess', () => {
  test('admin always has access', async () => {
    expect(await hasGeoAccess(db, String(addUser('admin')), 'admin')).toBe(true);
  });
  test('user without a grant has none', async () => {
    expect(await hasGeoAccess(db, String(addUser('user')), 'user')).toBe(false);
  });
  test('user with the geo grant has access', async () => {
    const id = addUser('user');
    db.insert(schema.userModules).values({ userId: id, module: 'geo' }).run();
    expect(await hasGeoAccess(db, String(id), 'user')).toBe(true);
  });
  test('an inventory/dwh grant does not imply geo', async () => {
    const id = addUser('user');
    db.insert(schema.userModules).values({ userId: id, module: 'dwh' }).run();
    expect(await hasGeoAccess(db, String(id), 'user')).toBe(false);
  });
});
