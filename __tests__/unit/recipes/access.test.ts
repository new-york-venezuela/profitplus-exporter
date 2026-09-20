process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import { hasRecipesAccess } from '@/lib/recipes/access';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, { schema });

beforeAll(() => {
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterEach(() => {
  sqlite.exec('DELETE FROM user_modules');
  sqlite.exec('DELETE FROM users');
});

describe('hasRecipesAccess', () => {
  test('admin always has access, even with no module grant', async () => {
    const admin = db.insert(schema.users).values({
      email: 'admin@example.com', name: 'Admin', passwordHash: 'x',
      role: 'admin', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    expect(await hasRecipesAccess(db, String(admin!.id), 'admin')).toBe(true);
  });

  test('regular user without a grant has no access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user@example.com', name: 'User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(false);
  });

  test('regular user with a recipes grant has access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user2@example.com', name: 'User Two', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'recipes' }).run();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(true);
  });

  test('a grant for a different module does not grant recipes access', async () => {
    const user = db.insert(schema.users).values({
      email: 'user3@example.com', name: 'User Three', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'inventory' }).run();

    expect(await hasRecipesAccess(db, String(user!.id), 'user')).toBe(false);
  });
});
