process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules, recipes, recipeLines } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as listRecipes, POST as createRecipe } from '@/app/api/recetas/recipes/route';
import { GET as getRecipe, PUT as putRecipe, DELETE as deleteRecipe } from '@/app/api/recetas/recipes/[id]/route';

function buildRequest(token: string | null, init: { method: string; body?: string }, url = 'http://localhost:3000/api/test'): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session=${token}`;
  return new NextRequest(url, { method: init.method, body: init.body, headers });
}

function resetDb() {
  const db = getDb();
  db.delete(recipeLines).run();
  db.delete(recipes).run();
  db.delete(userModules).run();
  db.delete(users).run();
}

let userToken: string;

beforeEach(async () => {
  resetDb();
  const db = getDb();
  const grantedUser = db.insert(users).values({
    email: 'user@test.com', name: 'User', passwordHash: 'x', role: 'user', createdAt: Date.now(),
  }).returning({ id: users.id }).get();
  db.insert(userModules).values({ userId: grantedUser!.id, module: 'recipes' }).run();
  userToken = await signToken({ sub: String(grantedUser!.id), role: 'user', name: 'User' });
});

afterEach(() => resetDb());

describe('recipes CRUD', () => {
  test('rejects an unauthenticated request', async () => {
    const res = await listRecipes(buildRequest(null, { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  test('rejects a user without the recipes grant', async () => {
    const db = getDb();
    const ungranted = db.insert(users).values({
      email: 'nogrant@test.com', name: 'No Grant', passwordHash: 'x', role: 'user', createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    const token = await signToken({ sub: String(ungranted!.id), role: 'user', name: 'No Grant' });

    const res = await listRecipes(buildRequest(token, { method: 'GET' }));
    expect(res.status).toBe(403);
  });

  test('creates a recipe and lists it', async () => {
    const createRes = await createRecipe(buildRequest(userToken, {
      method: 'POST',
      body: JSON.stringify({ coArt: '0000005', label: 'Baguette 4 Granos 220gr' }),
    }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeGreaterThan(0);

    const listRes = await listRecipes(buildRequest(userToken, { method: 'GET' }));
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].coArt).toBe('0000005');
  });

  test('rejects creating a duplicate coArt', async () => {
    await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Baguette' }),
    }));
    const dup = await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Otra vez' }),
    }));
    expect(dup.status).toBe(400);
  });

  test('gets a recipe with its lines, updates lines via full replace, then deletes it', async () => {
    const createRes = await createRecipe(buildRequest(userToken, {
      method: 'POST', body: JSON.stringify({ coArt: '0000005', label: 'Baguette 4 Granos 220gr' }),
    }));
    const { id } = await createRes.json();

    const putRes = await putRecipe(
      buildRequest(userToken, {
        method: 'PUT',
        body: JSON.stringify({
          label: 'Baguette 4 Granos 220gr', active: true,
          lines: [
            { lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.2, unit: 'KG', manualUnitCostUsd: null },
            { lineType: 'manual', coArt: null, manualLabel: 'Agua', quantity: 0.15, unit: 'LTS', manualUnitCostUsd: 0 },
          ],
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    expect(putRes.status).toBe(200);

    const getRes = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    const fetched = await getRes.json();
    expect(fetched.lines).toHaveLength(2);
    expect(fetched.lines.find((l: { lineType: string }) => l.lineType === 'manual').manualLabel).toBe('Agua');

    // full replace: saving again with one line should drop the other
    await putRecipe(
      buildRequest(userToken, {
        method: 'PUT',
        body: JSON.stringify({
          label: 'Baguette 4 Granos 220gr', active: true,
          lines: [{ lineType: 'erp_article', coArt: '0000083', manualLabel: null, quantity: 0.25, unit: 'KG', manualUnitCostUsd: null }],
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    const getRes2 = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    const fetched2 = await getRes2.json();
    expect(fetched2.lines).toHaveLength(1);
    expect(fetched2.lines[0].quantity).toBe(0.25);

    const deleteRes = await deleteRecipe(buildRequest(userToken, { method: 'DELETE' }), { params: Promise.resolve({ id: String(id) }) });
    expect(deleteRes.status).toBe(200);

    const getRes3 = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: String(id) }) });
    expect(getRes3.status).toBe(404);
  });

  test('returns 404 for a nonexistent recipe id', async () => {
    const res = await getRecipe(buildRequest(userToken, { method: 'GET' }), { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);
  });
});
