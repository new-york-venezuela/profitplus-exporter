process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect } from 'bun:test';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { signToken } from '@/lib/auth/session';
import { GET as getDashboard } from '@/app/api/inventory/dashboard/route';

function resetSqliteDb() {
  const db = getDb();
  db.delete(userModules).run();
  db.delete(users).run();
}

describe('GET /api/inventory/dashboard @mssql — allStock', () => {
  test('response includes an allStock array with every configured-warehouse item, not just flagged ones', async () => {
    resetSqliteDb();
    const db = getDb();
    const user = db.insert(users).values({
      email: 'dash-test@e2e.test', passwordHash: 'x', name: 'Dash Test', role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    db.insert(userModules).values({ userId: user!.id, module: 'inventory' }).run();
    const token = await signToken({ sub: String(user!.id), role: 'user', name: 'Dash Test' });

    const req = new NextRequest('http://localhost:3000/api/inventory/dashboard', {
      headers: { Cookie: `session=${token}` },
    });
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.allStock)).toBe(true);
    // allStock must be a superset of (or equal to) the flagged `items` list —
    // every flagged item's coArt+coAlma pair must also appear in allStock.
    for (const flagged of body.items) {
      expect(body.allStock.some((s: { coArt: string; coAlma: string }) =>
        s.coArt === flagged.coArt && s.coAlma === flagged.coAlma)).toBe(true);
    }
  });
});
