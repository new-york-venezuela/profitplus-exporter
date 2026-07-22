import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import path from 'path';
import * as schema from './schema';

const dbPath = path.resolve(process.env.SQLITE_PATH ?? './data/app.db');

// Singleton prevents multiple connections during Next.js hot reload in dev
const globalForDb = global as typeof global & { _sqlite?: Database };

const sqlite = globalForDb._sqlite ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') globalForDb._sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
