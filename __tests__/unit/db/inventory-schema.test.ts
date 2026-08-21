import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

let sqlite: Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterAll(() => {
  sqlite.close();
});

describe('user_modules', () => {
  test('stores a module grant for a user and can be queried back', () => {
    const user = db.insert(schema.users).values({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({
      userId: user!.id,
      module: 'inventory',
    }).run();

    const grants = db.select().from(schema.userModules)
      .where(eq(schema.userModules.userId, user!.id)).all();

    expect(grants).toHaveLength(1);
    expect(grants[0]!.module).toBe('inventory');
  });
});

describe('inventory_warehouses', () => {
  test('stores an admin-configured warehouse with active flag', () => {
    db.insert(schema.inventoryWarehouses).values({
      coAlma: '14',
      label: 'Materia Prima',
      active: true,
    }).run();

    const rows = db.select().from(schema.inventoryWarehouses).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coAlma).toBe('14');
    expect(rows[0]!.active).toBe(true);
  });
});

describe('inventory_settings', () => {
  test('has exactly one row with sane defaults after migration', () => {
    const rows = db.select().from(schema.inventorySettings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rollingWindowDays).toBeGreaterThan(0);
    expect(rows[0]!.daysOfStockThreshold).toBeGreaterThan(0);
  });
});
