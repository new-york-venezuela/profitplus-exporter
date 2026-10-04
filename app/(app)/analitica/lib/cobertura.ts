// Pure customer-coverage logic ("cobertura de clientes"). No server imports so
// the route and the client component share one source of truth.

export const LAPSED_AFTER_DAYS = 30;
export const NO_SELLER = '__none__';

export type CoberturaStatus = 'never' | 'via_matriz' | 'lapsed' | 'active';

const DAY_MS = 86_400_000;

function keyToUtcMs(key: number): number {
  const s = String(key);
  return Date.UTC(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
}

export function daysBetweenKeys(fromKey: number, toKey: number): number {
  return Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / DAY_MS);
}

export function classifyCoverage(
  lastSaleKey: number | null,
  entityLastSaleKey: number | null,
  todayKey: number,
): { status: CoberturaStatus; daysSinceLastSale: number | null } {
  if (lastSaleKey === null) {
    return { status: entityLastSaleKey === null ? 'never' : 'via_matriz', daysSinceLastSale: null };
  }
  const days = daysBetweenKeys(lastSaleKey, todayKey);
  return { status: days > LAPSED_AFTER_DAYS ? 'lapsed' : 'active', daysSinceLastSale: days };
}

// First day of the month 11 months before `today`'s month: with the current
// month this spans 12 calendar months.
export function trailingWindowStartKey(today: Date): number {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + 1;
}

// Average per month over the months the customer actually had invoices
// (a Jan/Mar/Apr buyer divides by 3), not over the calendar window.
export function averageOverInvoicedMonths(
  months: { units: number; usd: number | null }[],
): { avgUnits: number; avgUsd: number | null; months: number } | null {
  if (months.length === 0) return null;
  const n = months.length;
  const withUsd = months.filter(m => m.usd !== null);
  return {
    avgUnits: months.reduce((s, m) => s + m.units, 0) / n,
    avgUsd: withUsd.length === 0 ? null : withUsd.reduce((s, m) => s + (m.usd as number), 0) / n,
    months: n,
  };
}

interface SortableRow {
  daysSinceLastSale: number | null;
  status: CoberturaStatus;
  customerName: string;
}

const STATUS_RANK: Record<CoberturaStatus, number> = { never: 0, via_matriz: 1, lapsed: 2, active: 3 };

// Ascending: no data first (never, then via_matriz), then the most days since
// the last sale down to the most recent. Descending is the exact reverse.
export function compareDaysSince(a: SortableRow, b: SortableRow, dir: 'asc' | 'desc'): number {
  let cmp: number;
  if (a.daysSinceLastSale === null && b.daysSinceLastSale === null) {
    cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.customerName.localeCompare(b.customerName);
  } else if (a.daysSinceLastSale === null) {
    cmp = -1;
  } else if (b.daysSinceLastSale === null) {
    cmp = 1;
  } else {
    cmp = b.daysSinceLastSale - a.daysSinceLastSale;
  }
  return dir === 'asc' ? cmp : -cmp;
}

interface FilterableRow {
  sellerCode: string | null;
  status: CoberturaStatus;
}

export function filterCobertura<T extends FilterableRow>(
  rows: T[],
  f: { sellerCode?: string | null; status?: CoberturaStatus | null },
): T[] {
  return rows.filter(r => {
    if (f.sellerCode) {
      const code = r.sellerCode ?? NO_SELLER;
      if (code !== f.sellerCode) return false;
    }
    if (f.status && r.status !== f.status) return false;
    return true;
  });
}

export function summarizeCobertura(rows: { status: CoberturaStatus }[]) {
  const out = { never: 0, viaMatriz: 0, lapsed: 0, active: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === 'never') out.never++;
    else if (r.status === 'via_matriz') out.viaMatriz++;
    else if (r.status === 'lapsed') out.lapsed++;
    else out.active++;
  }
  return out;
}

export function groupBySeller<T extends { sellerCode: string | null; sellerName: string | null }>(
  rows: T[],
): { sellerCode: string | null; sellerName: string; rows: T[] }[] {
  const map = new Map<string, { sellerCode: string | null; sellerName: string; rows: T[] }>();
  for (const r of rows) {
    const key = r.sellerCode ?? NO_SELLER;
    let g = map.get(key);
    if (!g) {
      g = { sellerCode: r.sellerCode, sellerName: r.sellerCode === null ? 'Sin vendedor' : (r.sellerName ?? r.sellerCode), rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  return [...map.values()].sort((a, b) => {
    if (a.sellerCode === null) return 1;
    if (b.sellerCode === null) return -1;
    return a.sellerName.localeCompare(b.sellerName);
  });
}
