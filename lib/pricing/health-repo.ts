import { desc, and, eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { PricingAlertKind, PricingSweepRun } from '@/lib/db/schema';

export interface AlertSettings { enabled: boolean; daysAhead: number; recipients: string[] | null }

const T = schema.pricingSweepRuns;
const L = schema.pricingAlertLog;
const S = schema.pricingAlertSettings;

export function recordSweepRun(
  db: AppDb,
  r: { runAt: number; ok: boolean; moved: number; failed: number; error?: string | null },
): void {
  db.insert(T).values({ runAt: r.runAt, ok: r.ok ? 1 : 0, moved: r.moved, failed: r.failed, error: r.error ?? null }).run();
}

export function getLastSweepRun(db: AppDb): PricingSweepRun | undefined {
  return db.select().from(T).orderBy(desc(T.runAt), desc(T.id)).limit(1).get();
}

export function hasAlertBeenSent(db: AppDb, promotionId: number, kind: PricingAlertKind): boolean {
  return db.select({ id: L.id }).from(L).where(and(eq(L.promotionId, promotionId), eq(L.kind, kind))).get() !== undefined;
}

export function logAlertSent(db: AppDb, promotionId: number, kind: PricingAlertKind, sentOn: string): void {
  db.insert(L).values({ promotionId, kind, sentOn }).onConflictDoNothing().run();
}

function parseRecipients(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? v : null;
  } catch {
    return null;
  }
}

export function getAlertSettings(db: AppDb): AlertSettings {
  const row = db.select().from(S).where(eq(S.id, 1)).get();
  if (!row) return { enabled: true, daysAhead: 7, recipients: null };
  return { enabled: row.enabled === 1, daysAhead: row.daysAhead, recipients: parseRecipients(row.recipients) };
}

export function saveAlertSettings(db: AppDb, s: AlertSettings): void {
  const values = {
    enabled: s.enabled ? 1 : 0, daysAhead: s.daysAhead, recipients: s.recipients === null ? null : JSON.stringify(s.recipients),
  };
  db.insert(S).values({ id: 1, ...values }).onConflictDoUpdate({ target: S.id, set: values }).run();
}
