// Quotas live in SQLite seller_targets, keyed by (salesRepKey, periodMonth). A group/route root has
// no quota store of its own: its quota is the SUM of its sellers' quotas (a view, not a new store).
export interface SellerTargets {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
  unitsQuota: number | null;
}

export interface RolledQuota {
  salesQuotaUsd: number | null;
  weeklyVisitQuota: number | null;
  newCustomerQuota: number | null;
  unitsQuota: number | null;
  sellersTotal: number;
  partial: { sales: boolean; weeklyVisits: boolean; newCustomers: boolean; units: boolean };
}

function sum(
  keys: readonly string[],
  targets: ReadonlyMap<string, SellerTargets>,
  pick: (t: SellerTargets) => number | null,
): { total: number | null; partial: boolean } {
  let total: number | null = null;
  let missing = 0;
  for (const key of keys) {
    const t = targets.get(key);
    const v = t ? pick(t) : null;
    if (v === null || v === undefined) { missing++; continue; }
    total = (total ?? 0) + v;
  }
  return { total, partial: total !== null && missing > 0 };
}

export function rollUpQuotas(sellerKeys: readonly string[], targets: ReadonlyMap<string, SellerTargets>): RolledQuota {
  const keys = [...new Set(sellerKeys)];
  const sales = sum(keys, targets, t => t.salesQuotaUsd);
  const weekly = sum(keys, targets, t => t.weeklyVisitQuota);
  const fresh = sum(keys, targets, t => t.newCustomerQuota);
  const units = sum(keys, targets, t => t.unitsQuota);
  return {
    salesQuotaUsd: sales.total, weeklyVisitQuota: weekly.total, newCustomerQuota: fresh.total, unitsQuota: units.total,
    sellersTotal: keys.length,
    partial: { sales: sales.partial, weeklyVisits: weekly.partial, newCustomers: fresh.partial, units: units.partial },
  };
}
