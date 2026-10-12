import { eq } from 'drizzle-orm';
import { sellerTargets } from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { SellerTargets } from './quotas';

// seller_targets rows for one month, keyed by sales_rep_key (= Dim_SalesRep.SalesRepKey as text).
// Drizzle on bun:sqlite is synchronous (AGENTS.md "Code Conventions").
export function readTargetsForMonth(db: AppDb, month: string): Map<string, SellerTargets> {
  const rows = db.select().from(sellerTargets).where(eq(sellerTargets.periodMonth, month)).all();
  return new Map(rows.map(r => [r.salesRepKey, {
    salesQuotaUsd: r.salesQuotaUsd, weeklyVisitQuota: r.weeklyVisitQuota, newCustomerQuota: r.newCustomerQuota,
  }]));
}
