import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';

const SEED_USERS = [
  { email: 'admin@e2e.test', name: 'E2E Admin', password: 'AdminPass123!', role: 'admin' as const },
  { email: 'user@e2e.test',  name: 'E2E User',  password: 'UserPass123!',  role: 'user' as const },
  { email: 'reset-flow@e2e.test', name: 'E2E Reset Flow', password: 'ResetFlowPass123!', role: 'user' as const },
];

async function main() {
  const sqlitePath = process.env.SQLITE_PATH ?? './e2e/.tmp';
  const dbFile = path.resolve(sqlitePath, 'data', 'exporter.db');

  // Fresh DB every run: e2e specs assume exactly the two seeded users exist.
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(`${dbFile}-shm`, { force: true });
  fs.rmSync(`${dbFile}-wal`, { force: true });

  // bun:sqlite does not create parent directories; unlike the repo's default
  // ./data dir (tracked via .gitkeep), the e2e throwaway dir may not exist yet.
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });

  const db = getDb();
  migrate(db, { migrationsFolder: './drizzle/migrations' });

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const inserted = db.insert(users).values({
      email: u.email,
      name: u.name,
      passwordHash,
      role: u.role,
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();

    // admin@e2e.test gets inventory access via hasInventoryAccess's admin
    // bypass, needing no explicit grant. user@e2e.test needs one to exercise
    // the inventory module's e2e specs (items/adjustments/dashboard); no
    // inventory_warehouses rows are seeded, so those specs run against the
    // established empty-allowlist-means-all-warehouses fallback.
    if (u.email === 'user@e2e.test') {
      db.insert(userModules).values({ userId: inserted.id, module: 'inventory' }).run();
    }
  }

  console.log(`Seeded ${SEED_USERS.length} e2e users into ${dbFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
