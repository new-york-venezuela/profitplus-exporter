import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { getDb } from '@/lib/db/sqlite';

const db = getDb();
migrate(db, { migrationsFolder: './migrations/sqlite' });
console.log('✓ Migraciones aplicadas');
