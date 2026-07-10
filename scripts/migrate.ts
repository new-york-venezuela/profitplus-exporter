import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/sqlite';

migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('✓ Migraciones aplicadas');
