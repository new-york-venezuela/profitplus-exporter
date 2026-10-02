import { desc, eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { NewSegmentMeta, PricingAuditAction, PricingAuditRow, SegmentMeta } from '@/lib/db/schema';

export function getSegmentMetaMap(db: AppDb): Map<string, SegmentMeta> {
  const rows = db.select().from(schema.pricingSegmentMeta).all();
  return new Map(rows.map(r => [r.tipCli, r]));
}

export function getSegmentMeta(db: AppDb, tipCli: string): SegmentMeta | undefined {
  return db.select().from(schema.pricingSegmentMeta).where(eq(schema.pricingSegmentMeta.tipCli, tipCli)).get();
}

export function upsertSegmentMeta(db: AppDb, row: NewSegmentMeta): void {
  const { tipCli, ...rest } = row;
  db.insert(schema.pricingSegmentMeta).values(row)
    .onConflictDoUpdate({ target: schema.pricingSegmentMeta.tipCli, set: rest })
    .run();
}

export function setSegmentExpiry(db: AppDb, tipCli: string, expiresAt: string | null): boolean {
  const res = db.update(schema.pricingSegmentMeta).set({ expiresAt })
    .where(eq(schema.pricingSegmentMeta.tipCli, tipCli)).returning({ tipCli: schema.pricingSegmentMeta.tipCli }).all();
  return res.length > 0;
}

export function appendAudit(
  db: AppDb,
  e: { userId: string; action: PricingAuditAction; target: string; before?: unknown; after?: unknown; now?: number },
): void {
  db.insert(schema.pricingAuditLog).values({
    at: e.now ?? Date.now(),
    userId: e.userId,
    action: e.action,
    target: e.target,
    beforeJson: e.before === undefined ? null : JSON.stringify(e.before),
    afterJson: e.after === undefined ? null : JSON.stringify(e.after),
  }).run();
}

export function listAudit(db: AppDb, limit = 100): PricingAuditRow[] {
  return db.select().from(schema.pricingAuditLog).orderBy(desc(schema.pricingAuditLog.at), desc(schema.pricingAuditLog.id)).limit(limit).all();
}
