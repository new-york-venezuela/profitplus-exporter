import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import * as schema from '@/lib/db/schema';
import { users, userModules } from '@/lib/db/schema';
import { hasStatementsAccess } from './access';

// Throwaway migrated SQLite file; never touches the real data/exporter.db.
describe('hasStatementsAccess', () => {
  let tmpDir: string;
  let db: BunSQLiteDatabase<typeof schema>;
  let userId: number;

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'statements-access-test-'));
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
    userId = db.insert(users).values({
      email: 'statements-test@example.com',
      name: 'Statements Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get().id;
  });

  test('admin always has access', async () => {
    expect(await hasStatementsAccess(db, String(userId), 'admin')).toBe(true);
  });

  test('user without a grant is denied', async () => {
    expect(await hasStatementsAccess(db, String(userId), 'user')).toBe(false);
  });

  test('user with a statements grant is allowed', async () => {
    db.insert(userModules).values({ userId, module: 'statements' }).run();
    expect(await hasStatementsAccess(db, String(userId), 'user')).toBe(true);
  });

  test('a different module grant does not count', async () => {
    db.insert(userModules).values({ userId, module: 'geo' }).run();
    expect(await hasStatementsAccess(db, String(userId), 'user')).toBe(false);
  });
});
