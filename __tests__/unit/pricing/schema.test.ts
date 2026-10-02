import { describe, test, expect } from 'bun:test';
import { makeMemoryDb } from '../../helpers/memory-db';
import { pricingSegmentMeta, pricingAuditLog } from '@/lib/db/schema';

describe('pricing sqlite schema', () => {
  test('segment meta round-trips', () => {
    const db = makeMemoryDb();
    db.insert(pricingSegmentMeta).values({
      tipCli: '000010', kind: 'special', customerCoCli: 'C001', reason: 'promo oct',
      expiresAt: '2026-10-31', fallbackTipCli: '000001', previousTipCli: '000001',
      createdBy: '1', createdAt: 1,
    }).run();
    const row = db.select().from(pricingSegmentMeta).get()!;
    expect(row.kind).toBe('special');
    expect(row.expiresAt).toBe('2026-10-31');
  });
  test('audit log auto-increments and stores json text', () => {
    const db = makeMemoryDb();
    db.insert(pricingAuditLog).values({ at: 1, userId: '1', action: 'customer_move', target: 'C001', beforeJson: '{"a":1}', afterJson: null }).run();
    db.insert(pricingAuditLog).values({ at: 2, userId: '1', action: 'customer_move', target: 'C002' }).run();
    expect(db.select().from(pricingAuditLog).all().map(r => r.id)).toEqual([1, 2]);
  });
});
