import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from '@/lib/db/sqlite';

migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('✓ Migraciones aplicadas');
