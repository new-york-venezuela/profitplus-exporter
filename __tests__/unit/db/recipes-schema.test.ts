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
  sqlite.exec('PRAGMA foreign_keys = ON;'); // matches lib/db/sqlite.ts — bun:sqlite doesn't enforce FKs (or cascades) by default
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle/migrations' });
});

afterAll(() => {
  sqlite.close();
});

describe('recipes', () => {
  test('stores a recipe with an erp_article line and a manual line, cascades on delete', () => {
    const now = Date.now();
    const recipe = db.insert(schema.recipes).values({
      coArt: '0000005', label: 'Baguette 4 Granos 220gr', active: true,
      createdAt: now, updatedAt: now,
    }).returning({ id: schema.recipes.id }).get();

    db.insert(schema.recipeLines).values([
      {
        recipeId: recipe!.id, lineType: 'erp_article', coArt: '0000083',
        manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null, sortOrder: 0,
      },
      {
        recipeId: recipe!.id, lineType: 'manual', coArt: null,
        manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0, sortOrder: 1,
      },
    ]).run();

    const lines = db.select().from(schema.recipeLines)
      .where(eq(schema.recipeLines.recipeId, recipe!.id)).all();
    expect(lines).toHaveLength(2);
    expect(lines.find(l => l.lineType === 'erp_article')?.coArt).toBe('0000083');
    expect(lines.find(l => l.lineType === 'manual')?.manualLabel).toBe('Agua');

    db.delete(schema.recipes).where(eq(schema.recipes.id, recipe!.id)).run();
    const afterDelete = db.select().from(schema.recipeLines)
      .where(eq(schema.recipeLines.recipeId, recipe!.id)).all();
    expect(afterDelete).toHaveLength(0);
  });

  test('coArt is unique across recipes', () => {
    const now = Date.now();
    db.insert(schema.recipes).values({
      coArt: '0000043', label: 'Demi Baguette', active: true, createdAt: now, updatedAt: now,
    }).run();

    expect(() => {
      db.insert(schema.recipes).values({
        coArt: '0000043', label: 'Duplicado', active: true, createdAt: now, updatedAt: now,
      }).run();
    }).toThrow();
  });
});

describe('user_modules recipes grant', () => {
  test('accepts the recipes module value', () => {
    const user = db.insert(schema.users).values({
      email: 'recetas@example.com', name: 'Recetas User', passwordHash: 'x',
      role: 'user', createdAt: Date.now(),
    }).returning({ id: schema.users.id }).get();

    db.insert(schema.userModules).values({ userId: user!.id, module: 'recipes' }).run();

    const grants = db.select().from(schema.userModules)
      .where(eq(schema.userModules.userId, user!.id)).all();
    expect(grants[0]!.module).toBe('recipes');
  });
});
