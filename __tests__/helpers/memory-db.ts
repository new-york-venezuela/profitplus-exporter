import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';

/** Fresh in-memory SQLite with the project's real migrations applied. Never touches data/exporter.db. */
export function makeMemoryDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './migrations/sqlite' });
  return db;
}
