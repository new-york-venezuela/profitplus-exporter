process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, recipes, recipeLines } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getCost } from '@/app/api/recetas/recipes/[id]/cost/route';

function buildRequest(token: string, url = 'http://localhost:3000/api/test'): NextRequest {
  return new NextRequest(url, { headers: { Cookie: `session=${token}` } });
}

function resetDb() {
  const db = getDb();
  db.delete(recipeLines).run();
  db.delete(recipes).run();
  db.delete(userModules).run();
  db.delete(users).run();
}

let token: string;

beforeEach(async () => {
  resetDb();
  const db = getDb();
  const user = db.insert(users).values({
    email: 'user@test.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: user!.id, module: 'recipes' }).run();
  token = await signToken({ sub: String(user!.id), role: 'user', name: 'User' });
});

afterEach(() => resetDb());

describe('GET /api/recetas/recipes/[id]/cost', () => {
  test('computes the live cost for a recipe with an ERP line and a manual line', async () => {
    const db = getDb();
    const now = Date.now();
    const recipe = db.insert(recipes).values({
      coArt: '0000005', label: 'Baguette 4 Granos 220gr', active: true, createdAt: now, updatedAt: now,
    }).returning({ id: recipes.id }).get();

    db.insert(recipeLines).values([
      { recipeId: recipe!.id, lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null, sortOrder: 0 },
      { recipeId: recipe!.id, lineType: 'manual', coArt: null, manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0.05, sortOrder: 1 },
    ]).run();

    const res = await getCost(buildRequest(token), { params: Promise.resolve({ id: String(recipe!.id) }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.lines).toHaveLength(2);
    expect(body.totalUsd).toBeGreaterThan(0);
    const manualLine = body.lines.find((l: { lineType: string }) => l.lineType === 'manual');
    expect(manualLine.costUsd).toBeCloseTo(0.15 * 0.05, 5);
  });

  test('returns 404 for a nonexistent recipe', async () => {
    const res = await getCost(buildRequest(token), { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);
  });
});
