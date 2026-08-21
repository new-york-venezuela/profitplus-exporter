import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import path from 'path';
import * as schema from './schema';

const dbPath = path.resolve(process.env.SQLITE_PATH ?? './', 'data', 'exporter.db');

const globalForDb = global as typeof global & {
  _sqlite?: Database;
  _drizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDb() {
  if (!globalForDb._sqlite) {
    globalForDb._sqlite = new Database(dbPath);
    globalForDb._sqlite.exec('PRAGMA foreign_keys = ON;');
  }
  if (!globalForDb._drizzle) {
    globalForDb._drizzle = drizzle(globalForDb._sqlite, { schema });
  }
  return globalForDb._drizzle;
}
