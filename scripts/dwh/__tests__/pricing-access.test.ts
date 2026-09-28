import { describe, test, expect, beforeEach } from 'bun:test';
import { getDb } from '../../../lib/db/sqlite';
import { users, userModules } from '../../../lib/db/schema';
import { getPricingAccessLevel } from '../../../lib/pricing/access';

describe('getPricingAccessLevel', () => {
  let userId: number;

  beforeEach(() => {
    const db = getDb();
    db.delete(userModules).run();
    db.delete(users).run();
    const inserted = db.insert(users).values({
      email: `pricing-test-${Date.now()}@example.com`,
      name: 'Pricing Test User',
      passwordHash: 'x',
      role: 'user',
      createdAt: Date.now(),
    }).returning({ id: users.id }).get();
    userId = inserted.id;
  });

  test('returns "none" with no grant rows', async () => {
    const db = getDb();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('none');
  });

  test('returns "view" with only a pricing_view row', async () => {
    const db = getDb();
    db.insert(userModules).values({ userId, module: 'pricing_view' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('view');
  });

  test('returns "edit" with a pricing_edit row (view row not required)', async () => {
    const db = getDb();
    db.insert(userModules).values({ userId, module: 'pricing_edit' }).run();
    const level = await getPricingAccessLevel(db, String(userId), 'user');
    expect(level).toBe('edit');
  });

  test('returns "edit" for an admin regardless of grant rows', async () => {
    const db = getDb();
    const level = await getPricingAccessLevel(db, String(userId), 'admin');
    expect(level).toBe('edit');
  });
});
