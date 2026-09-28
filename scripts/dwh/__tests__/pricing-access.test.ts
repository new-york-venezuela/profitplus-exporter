import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import * as schema from '../../../lib/db/schema';
import { users, userModules } from '../../../lib/db/schema';
import { getPricingAccessLevel } from '../../../lib/pricing/access';

// Unlike the other DWH/ERP integration tests under scripts/dwh/__tests__/,
// this test exercises the app's own SQLite users/user_modules tables. It
// MUST NOT touch the real database that SQLITE_PATH points to (previously
// it did, via a blanket `db.delete(users).run()` in beforeEach, which wiped
// this worktree's data/exporter.db down to a single leftover row). Instead
// it builds its own throwaway SQLite file in the OS temp dir, migrates it
// with the project's real migrations, and points a separate Drizzle client
// at that file only -- getDb() / lib/db/sqlite.ts is never called here.
describe('getPricingAccessLevel', () => {
  let tmpDir: string;
  let db: BunSQLiteDatabase<typeof schema>;
  let userId: number;

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'pricing-access-test-'));
    const sqlite = new Database(path.join(tmpDir, 'test.db'));
    sqlite.exec('PRAGMA foreign_keys = ON;');
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './migrations/sqlite' });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    db.delete(userModules).run();
    db.delete(users).run();
    const inserted = db.insert(users).values({
      email: `pricing-test-${Date.now()}@example.com`,
      name: 'Pricing Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    userId = inserted.id;
  });

  test('returns "none" with no grant rows', async () => {
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('none');
  });

  test('returns "view" with only a pricing_view row', async () => {
    db.insert(userModules).values({ userId, module: 'pricing_view' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('view');
  });

  test('returns "edit" with a pricing_edit row (view row not required)', async () => {
    db.insert(userModules).values({ userId, module: 'pricing_edit' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('edit');
  });

  test('returns "edit" for an admin regardless of grant rows', async () => {
    const level = await getPricingAccessLevel(db, String(userId), 'admin');
    expect(level).toBe('edit');
  });
});
