# Clientes: cobertura de ventas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Cobertura de clientes" section in the Clientes tab listing every customer with last sale date, days since, trailing-12-month monthly average (USD and units), default seller and status, with "Sin datos" for missing values, print-by-seller and Excel export.

**Architecture:** Pure, unit-tested logic in `app/(app)/analitica/lib/cobertura.ts` (status, sort, filter, averaging, grouping). A new DWH-only route `GET /api/dwh/clientes/cobertura` runs two queries (customers + last sale; per-month sales) and returns JSON or XLSX. A client component renders summary boxes, filters, table and a print-only per-seller layout.

**Tech Stack:** Next.js 16, mssql (DWH), `lib/xlsx.ts` (`buildXlsx`), Tailwind print variants, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-04-clientes-cobertura-design.md`

**Execution order / dependencies:** PLAN 2 OF 5. **Depends on plan 1** (`2026-10-04-1-resumen-units-and-kpi-groups.md`) for `components/kpi-card.tsx` / `kpi-group.tsx`. Followed by plans 3 (Ventas), 4 (Devoluciones, also needs plan 1), 5 (CxC).

## Global Constraints

- DWH only via `getDwhPool()`; route gated by `requireDwhAccess`; errors `{ error: string }`.
- Row grain = one row per `CustomerCode`, current SCD2 version (`IsCurrent = 1`); sales are aggregated across ALL versions of a code (`Fact_Sales.CustomerKey` may point at an old version). Name/seller come from the current version only.
- Inactive customers excluded unless `includeInactive=1`.
- Section ignores the page date range. Last sale = all history, voided invoices excluded.
- Lapsed cutoff: `LAPSED_AFTER_DAYS = 30`.
- Monthly average = sum over trailing window ÷ number of **distinct months with ≥1 invoice in the window**; window = 12 calendar months ending with the current month (first day of the month 11 months back through today). Ventas brutas basis (`NetAmount`, USD at each invoice's own date rate via `usdConversionJoin`).
- Missing values render "Sin datos". Ascending sort of "Días sin vender": no data first, then most days → fewest.
- Store with no own invoices: `never` only if its legal entity also has no sales; else `via_matriz`.
- Spanish UI copy; print = `window.print()`; Excel via `buildXlsx`.

## Review Focus

- Customer with sales only before the window: last sale shown, averages "Sin datos", status by days.
- Buyer in Jan, Mar, Apr (three invoiced months) averages over 3, not 12 or 4.
- Entity-less customer (`LegalEntityKey NULL`) with no sales is `never` (no matrix to vouch for it).
- Customer with no seller: grouped under "Sin vendedor", included in print and Excel.
- Same customer code with two SCD2 versions and sales on the old version: counted once, with the old sales.
- Empty result (all filters exclude everything): table shows an empty state, print/Excel buttons don't crash.

## File Structure

- Create `app/(app)/analitica/lib/cobertura.ts` — pure logic. Test: `lib/__tests__/cobertura.test.ts`.
- Modify `app/(app)/analitica/types.ts` — `CoberturaStatus`, `CoberturaRowView`, `CoberturaResponse`.
- Create `app/api/dwh/clientes/cobertura/route.ts` — JSON + XLSX.
- Create `app/(app)/analitica/components/cobertura-clientes.tsx` — UI.
- Modify `app/(app)/analitica/tabs/tab-clientes.tsx` — mount the section on top.
- Modify `content/help/analitica-definiciones.md`.

---

### Task 1: Pure cobertura logic

**Files:**
- Create: `app/(app)/analitica/lib/cobertura.ts`
- Test: `app/(app)/analitica/lib/__tests__/cobertura.test.ts`

**Interfaces:**
- Produces (all exported from `lib/cobertura.ts`):
  - `LAPSED_AFTER_DAYS = 30`
  - `type CoberturaStatus = 'never' | 'via_matriz' | 'lapsed' | 'active'`
  - `daysBetweenKeys(fromKey: number, toKey: number): number`
  - `classifyCoverage(lastSaleKey: number | null, entityLastSaleKey: number | null, todayKey: number): { status: CoberturaStatus; daysSinceLastSale: number | null }`
  - `trailingWindowStartKey(today: Date): number`
  - `averageOverInvoicedMonths(months: { units: number; usd: number | null }[]): { avgUnits: number; avgUsd: number | null; months: number } | null`
  - `compareDaysSince(a: SortableRow, b: SortableRow, dir: 'asc' | 'desc'): number`, `SortableRow = { daysSinceLastSale: number | null; status: CoberturaStatus; customerName: string }`
  - `filterCobertura<T extends FilterableRow>(rows: T[], f: { sellerCode?: string | null; status?: CoberturaStatus | null }): T[]`, `NO_SELLER = '__none__'`
  - `summarizeCobertura(rows): { never: number; viaMatriz: number; lapsed: number; active: number; total: number }`
  - `groupBySeller<T extends { sellerCode: string | null; sellerName: string | null }>(rows: T[]): { sellerCode: string | null; sellerName: string; rows: T[] }[]`

- [ ] **Step 1: Failing tests**

```ts
import { describe, test, expect } from 'bun:test';
import {
  LAPSED_AFTER_DAYS, NO_SELLER, daysBetweenKeys, classifyCoverage, trailingWindowStartKey,
  averageOverInvoicedMonths, compareDaysSince, filterCobertura, summarizeCobertura, groupBySeller,
} from '../cobertura';

describe('daysBetweenKeys', () => {
  test('counts calendar days across a month boundary', () => {
    expect(daysBetweenKeys(20260930, 20261004)).toBe(4);
    expect(daysBetweenKeys(20261004, 20261004)).toBe(0);
  });
});

describe('classifyCoverage', () => {
  const today = 20261004;
  test('no own and no entity sales is never', () => {
    expect(classifyCoverage(null, null, today)).toEqual({ status: 'never', daysSinceLastSale: null });
  });
  test('no own sales but entity sold is via_matriz with no own days', () => {
    expect(classifyCoverage(null, 20260901, today)).toEqual({ status: 'via_matriz', daysSinceLastSale: null });
  });
  test('exactly 30 days is still active, 31 is lapsed', () => {
    expect(classifyCoverage(20260904, null, today).status).toBe('active');
    expect(classifyCoverage(20260903, null, today).status).toBe('lapsed');
    expect(LAPSED_AFTER_DAYS).toBe(30);
  });
});

describe('trailingWindowStartKey', () => {
  test('is the first day of the month 11 months back', () => {
    expect(trailingWindowStartKey(new Date(Date.UTC(2026, 9, 4)))).toBe(20251101);
    expect(trailingWindowStartKey(new Date(Date.UTC(2026, 0, 15)))).toBe(20250201);
  });
});

describe('averageOverInvoicedMonths', () => {
  test('divides by invoiced months only (Jan, Mar, Apr = 3)', () => {
    const r = averageOverInvoicedMonths([{ units: 30, usd: 300 }, { units: 60, usd: 600 }, { units: 90, usd: 900 }]);
    expect(r).toEqual({ avgUnits: 60, avgUsd: 600, months: 3 });
  });
  test('no invoiced months is null', () => expect(averageOverInvoicedMonths([])).toBeNull());
  test('usd is null when no month has a USD figure', () => {
    expect(averageOverInvoicedMonths([{ units: 10, usd: null }])).toEqual({ avgUnits: 10, avgUsd: null, months: 1 });
  });
});

describe('compareDaysSince', () => {
  const row = (days: number | null, status: 'never' | 'via_matriz' | 'lapsed' | 'active', customerName: string) =>
    ({ daysSinceLastSale: days, status, customerName });
  test('ascending: no data first, then most days down to fewest', () => {
    const rows = [row(5, 'active', 'e'), row(null, 'via_matriz', 'b'), row(90, 'lapsed', 'd'), row(null, 'never', 'a')];
    const sorted = [...rows].sort((x, y) => compareDaysSince(x, y, 'asc')).map(r => r.customerName);
    expect(sorted).toEqual(['a', 'b', 'd', 'e']);
  });
  test('descending is the exact reverse', () => {
    const rows = [row(5, 'active', 'e'), row(null, 'never', 'a'), row(90, 'lapsed', 'd')];
    const sorted = [...rows].sort((x, y) => compareDaysSince(x, y, 'desc')).map(r => r.customerName);
    expect(sorted).toEqual(['e', 'd', 'a']);
  });
});

describe('filter / summarize / group', () => {
  const rows = [
    { sellerCode: 'V1', sellerName: 'Ana', status: 'never' as const },
    { sellerCode: 'V1', sellerName: 'Ana', status: 'active' as const },
    { sellerCode: null, sellerName: null, status: 'lapsed' as const },
    { sellerCode: 'V2', sellerName: 'Bruno', status: 'via_matriz' as const },
  ];
  test('filters by seller, including the no-seller bucket', () => {
    expect(filterCobertura(rows, { sellerCode: 'V1' })).toHaveLength(2);
    expect(filterCobertura(rows, { sellerCode: NO_SELLER })).toHaveLength(1);
    expect(filterCobertura(rows, { status: 'lapsed' })).toHaveLength(1);
    expect(filterCobertura(rows, {})).toHaveLength(4);
  });
  test('summarizes by status', () => {
    expect(summarizeCobertura(rows)).toEqual({ never: 1, viaMatriz: 1, lapsed: 1, active: 1, total: 4 });
  });
  test('groups by seller sorted by name with "Sin vendedor" last', () => {
    const groups = groupBySeller(rows);
    expect(groups.map(g => g.sellerName)).toEqual(['Ana', 'Bruno', 'Sin vendedor']);
    expect(groups[0].rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2:** Run `bun test "app/(app)/analitica/lib/__tests__/cobertura.test.ts"` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/cobertura.ts`**

```ts
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
```

- [ ] **Step 4:** Run the test → PASS.
- [ ] **Step 5:** `git add -A && git commit -m "feat(analitica): pure cobertura logic"`

---

### Task 2: Types and API route (JSON + XLSX)

**Files:**
- Modify: `app/(app)/analitica/types.ts` (append)
- Create: `app/api/dwh/clientes/cobertura/route.ts`

**Interfaces:**
- Consumes: Task 1 exports; `usdConversionJoin` from `@/app/api/dwh/lib/query-builder`; `buildXlsx` from `@/lib/xlsx`; `requireDwhAccess`; `getDwhPool`.
- Produces: `CoberturaRowView`, `CoberturaResponse` (JSON of `GET /api/dwh/clientes/cobertura?includeInactive=0|1`); with `format=xlsx&seller=&status=` an XLSX attachment of the filtered rows.

- [ ] **Step 1: Types** — append to `types.ts`:

```ts
// Clientes tab — cobertura de clientes (see lib/cobertura.ts). Independent of the date range.
export type CoberturaStatus = 'never' | 'via_matriz' | 'lapsed' | 'active';

export interface CoberturaRowView {
  customerCode: string;
  customerName: string;
  entityName: string | null;
  sellerCode: string | null;
  sellerName: string | null;
  lastSaleDateKey: number | null; // own invoices, all history; null = no invoice found
  entityLastSaleDateKey: number | null; // any store of the same legal entity
  daysSinceLastSale: number | null;
  avgMonthlyUsd: number | null; // trailing 12 months, over invoiced months only
  avgMonthlyUnits: number | null;
  monthsWithSales: number;
  status: CoberturaStatus;
}

export interface CoberturaResponse {
  rows: CoberturaRowView[];
  asOfDateKey: number;
  windowStartDateKey: number;
  lapsedAfterDays: number;
}
```

(Import `CoberturaStatus` from `./lib/cobertura` instead of redeclaring if preferred — keep exactly one definition: re-export in `types.ts` with `export type { CoberturaStatus } from './lib/cobertura';` and delete the duplicate union above.)

- [ ] **Step 2: Route** — `app/api/dwh/clientes/cobertura/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { usdConversionJoin, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { buildXlsx } from '@/lib/xlsx';
import {
  LAPSED_AFTER_DAYS, averageOverInvoicedMonths, classifyCoverage, compareDaysSince, filterCobertura,
  trailingWindowStartKey, type CoberturaStatus,
} from '@/app/(app)/analitica/lib/cobertura';
import type { CoberturaResponse, CoberturaRowView } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// One row per CURRENT customer version. Sales are keyed by CustomerKey, which
// may point at an older SCD2 version of the same code, so every sales
// aggregate groups by RTRIM(CustomerCode) across all versions.
function customersQuery(includeInactive: boolean): string {
  return `
    WITH Cur AS (
      SELECT RTRIM(c.CustomerCode) AS Code, c.CustomerName, RTRIM(c.DefaultSalesRepCode) AS SellerCode, c.LegalEntityKey
      FROM dim.Dim_Customer c
      WHERE c.IsCurrent = 1 ${includeInactive ? '' : 'AND c.IsInactive = 0'}
    ),
    OwnSales AS (
      SELECT RTRIM(c.CustomerCode) AS Code, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0
      GROUP BY RTRIM(c.CustomerCode)
    ),
    EntitySales AS (
      SELECT c.LegalEntityKey, MAX(fs.DateKey) AS LastDateKey
      FROM fact.Fact_Sales fs
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey IS NOT NULL
      GROUP BY c.LegalEntityKey
    )
    SELECT cur.Code AS CustomerCode, cur.CustomerName, le.LegalEntityName, cur.SellerCode,
           r.SalesRepName AS SellerName, o.LastDateKey, e.LastDateKey AS EntityLastDateKey
    FROM Cur cur
    LEFT JOIN OwnSales o ON o.Code = cur.Code
    LEFT JOIN EntitySales e ON e.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_LegalEntity le ON le.LegalEntityKey = cur.LegalEntityKey
    LEFT JOIN dim.Dim_SalesRep r ON RTRIM(r.SalesRepCode) = cur.SellerCode
  `;
}

const MONTHLY_QUERY = `
  SELECT RTRIM(c.CustomerCode) AS Code, d.YearMonth,
         SUM(fs.QuantitySold) AS Units,
         SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS Usd
  FROM fact.Fact_Sales fs
  JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
  JOIN dim.Dim_Date d ON d.DateKey = fs.DateKey
  ${usdConversionJoin('fs')}
  WHERE fs.IsVoided = 0 AND fs.DateKey >= @windowStartKey
  GROUP BY RTRIM(c.CustomerCode), d.YearMonth
`;

function dateKeyOf(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

const STATUS_LABEL: Record<CoberturaStatus, string> = {
  never: 'Nunca vendido',
  via_matriz: 'Vende vía matriz',
  lapsed: `Sin ventas en ${LAPSED_AFTER_DAYS}+ días`,
  active: 'Activo',
};

function isStatus(v: string | null): v is CoberturaStatus {
  return v === 'never' || v === 'via_matriz' || v === 'lapsed' || v === 'active';
}

function formatKey(key: number | null): string {
  if (key === null) return 'Sin datos';
  const s = String(key);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === '1';
  const format = searchParams.get('format');
  const statusParam = searchParams.get('status');

  try {
    const pool = await getDwhPool();
    const now = new Date();
    const todayKey = dateKeyOf(now);
    const windowStartKey = trailingWindowStartKey(now);

    const [customers, monthly] = await Promise.all([
      pool.request().query(customersQuery(includeInactive)),
      pool.request().input('windowStartKey', windowStartKey).query(MONTHLY_QUERY),
    ]);

    const monthsByCode = new Map<string, { units: number; usd: number | null }[]>();
    for (const m of monthly.recordset) {
      const list = monthsByCode.get(m.Code) ?? [];
      list.push({ units: Number(m.Units ?? 0), usd: m.Usd === null ? null : Number(m.Usd) });
      monthsByCode.set(m.Code, list);
    }

    const rows: CoberturaRowView[] = customers.recordset.map(r => {
      const lastSaleDateKey = r.LastDateKey === null ? null : Number(r.LastDateKey);
      const entityLastSaleDateKey = r.EntityLastDateKey === null ? null : Number(r.EntityLastDateKey);
      const { status, daysSinceLastSale } = classifyCoverage(lastSaleDateKey, entityLastSaleDateKey, todayKey);
      const avg = averageOverInvoicedMonths(monthsByCode.get(r.CustomerCode) ?? []);
      return {
        customerCode: r.CustomerCode,
        customerName: (r.CustomerName ?? r.CustomerCode).trim(),
        entityName: r.LegalEntityName ? String(r.LegalEntityName).trim() : null,
        sellerCode: r.SellerCode ? String(r.SellerCode) : null,
        sellerName: r.SellerName ? String(r.SellerName).trim() : null,
        lastSaleDateKey,
        entityLastSaleDateKey,
        daysSinceLastSale,
        avgMonthlyUsd: avg?.avgUsd ?? null,
        avgMonthlyUnits: avg?.avgUnits ?? null,
        monthsWithSales: avg?.months ?? 0,
        status,
      };
    });
    rows.sort((a, b) => compareDaysSince(a, b, 'asc'));

    if (format === 'xlsx') {
      const filtered = filterCobertura(rows, {
        sellerCode: searchParams.get('seller'),
        status: isStatus(statusParam) ? statusParam : null,
      });
      const columns = [
        { key: 'cliente', label: 'Cliente', defaultVisible: true, defaultOrder: 0 },
        { key: 'codigo', label: 'Código', defaultVisible: true, defaultOrder: 1 },
        { key: 'entidad', label: 'Entidad', defaultVisible: true, defaultOrder: 2 },
        { key: 'vendedor', label: 'Vendedor', defaultVisible: true, defaultOrder: 3 },
        { key: 'ultimaVenta', label: 'Última venta', defaultVisible: true, defaultOrder: 4 },
        { key: 'dias', label: 'Días sin vender', defaultVisible: true, defaultOrder: 5, type: 'number' as const },
        { key: 'usdMes', label: 'USD/mes (prom. 12m)', defaultVisible: true, defaultOrder: 6, type: 'number' as const },
        { key: 'unidadesMes', label: 'Unidades/mes (prom. 12m)', defaultVisible: true, defaultOrder: 7, type: 'number' as const },
        { key: 'estado', label: 'Estado', defaultVisible: true, defaultOrder: 8 },
      ];
      const data = filtered.map(r => ({
        cliente: r.customerName,
        codigo: r.customerCode,
        entidad: r.entityName ?? 'Sin datos',
        vendedor: r.sellerName ?? 'Sin vendedor',
        ultimaVenta: r.lastSaleDateKey === null
          ? (r.status === 'via_matriz' ? `Sin datos (matriz: ${formatKey(r.entityLastSaleDateKey)})` : 'Sin datos')
          : formatKey(r.lastSaleDateKey),
        dias: r.daysSinceLastSale ?? 'Sin datos',
        usdMes: r.avgMonthlyUsd === null ? 'Sin datos' : Math.round(r.avgMonthlyUsd * 100) / 100,
        unidadesMes: r.avgMonthlyUnits === null ? 'Sin datos' : Math.round(r.avgMonthlyUnits * 100) / 100,
        estado: STATUS_LABEL[r.status],
      }));
      const buffer = buildXlsx(columns, data);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="cobertura-clientes-${todayKey}.xlsx"`,
        },
      });
    }

    const response: CoberturaResponse = {
      rows, asOfDateKey: todayKey, windowStartDateKey: windowStartKey, lapsedAfterDays: LAPSED_AFTER_DAYS,
    };
    return jsonWithCache(response);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify against the live DWH** with a throwaway `bun test` that mocks `@/lib/dwh/access`, calls `GET` for JSON and `format=xlsx`, and asserts status 200, the JSON `rows.length` equals the count of non-inactive current customers (`SELECT COUNT(*) FROM dim.Dim_Customer WHERE IsCurrent=1 AND IsInactive=0`), the first rows have `daysSinceLastSale === null`, and the XLSX body starts with the `PK` zip magic. Do not commit the scratch file.
- [ ] **Step 4:** `bunx tsc --noEmit -p .` → clean.
- [ ] **Step 5:** `git add -A && git commit -m "feat(analitica): cobertura de clientes API (json + xlsx)"`

---

### Task 3: UI component, print layout and tab mount

**Files:**
- Create: `app/(app)/analitica/components/cobertura-clientes.tsx`
- Modify: `app/(app)/analitica/tabs/tab-clientes.tsx` (render `<CoberturaClientes />` as the first child of the root `<div className="p-6 max-w-7xl space-y-6">`; add the import)

**Interfaces:**
- Consumes: `CoberturaResponse`/`CoberturaRowView` (Task 2), pure helpers (Task 1), `KpiCard`/`KpiGroup` (plan 1), `SearchableSelect` (`@/lib/components/searchable-select`, `onChange(value: string | null)`, `allLabel`).
- Produces: `export default function CoberturaClientes()` (no props: volume is always USD, independent of the page currency).

- [ ] **Step 1: Implement the component.** Behaviour (exact):
  - State: `data`, `loading`, `error`, `includeInactive` (bool), `sellerFilter: string | null`, `statusFilter: CoberturaStatus | null`, `sortKey: 'days'|'customer'|'seller'|'usd'|'units'` (default `'days'`), `sortDir` (default `'asc'`).
  - Fetch `/api/dwh/clientes/cobertura?includeInactive=${0|1}` in a cancellable `useEffect` keyed on `includeInactive` (same pattern as `TabClientes`).
  - Derived: `sellerOptions` from distinct `sellerCode` (label = `sellerName ?? sellerCode`; plus `{ value: NO_SELLER, label: 'Sin vendedor' }` when any row has no seller), `filtered = filterCobertura(rows, …)`, `sorted` (days → `compareDaysSince`; customer/seller → `localeCompare`; usd/units → numeric with null last in both directions), `summary = summarizeCobertura(rows)` (counts of ALL rows, not the filtered ones).
  - Header: title "Cobertura de clientes", note "No depende del período seleccionado: última venta sobre todo el histórico; promedios de los últimos 12 meses sobre los meses con facturas." Buttons "Imprimir" (`posthog.capture('cobertura_print', …)` then `window.print()`) and "Exportar Excel" (`posthog.capture('cobertura_export', …)` then `window.location.href = '/api/dwh/clientes/cobertura?format=xlsx&includeInactive=…&seller=…&status=…'`, omitting empty params).
  - Four `KpiCard`s in a `KpiGroup` ("Cobertura", tone `customers`): Nunca vendido, Vende vía matriz, Sin ventas 30+ días, Activos.
  - Filters row: `SearchableSelect` for seller (`allLabel="Todos los vendedores"`), a native `<select>` for status (Todos / four statuses), a checkbox "Incluir inactivos".
  - Table columns: Cliente (name + code small), Entidad, Vendedor, Última venta (own date; for `via_matriz` show "Sin datos" with small text "matriz: dd/mm/aaaa"; for none "Sin datos"), Días sin vender ("Sin datos" when null), USD/mes, Unidades/mes (USD uses `$` + `en-US` no decimals via `moneyLabel`-style formatting; "Sin datos" when null; units `es-VE`, 0 decimals), Estado (coloured text badge with the label). Column headers for days/customer/seller/usd/units are sortable buttons toggling `sortDir` (`aria-sort`).
  - USD columns are always USD regardless of the page currency toggle (volume is USD by requirement) — label them "USD/mes".
  - Empty states: loading "Cargando…", error box, zero filtered rows "Ningún cliente coincide con los filtros."
  - Print layout: a `<div id="cobertura-print" className="hidden print:block">` rendering, for each `groupBySeller(sorted)` group, a `<section className="cobertura-seller-block">` with an `<h2>` "Cobertura de clientes — Vendedor: {name}" plus the date ("al dd/mm/aaaa" from `asOfDateKey`), a compact table (Cliente, Entidad, Última venta, Días, USD/mes, Unid./mes, Estado) and the group's counts. A `<style>` element in the component supplies:

```css
@media print {
  body * { visibility: hidden !important; }
  #cobertura-print, #cobertura-print * { visibility: visible !important; }
  #cobertura-print { position: absolute; left: 0; top: 0; width: 100%; }
  .cobertura-seller-block { break-before: page; }
  .cobertura-seller-block:first-child { break-before: auto; }
}
```

  and the on-screen section gets `print:hidden`.

- [ ] **Step 2:** Mount in `tab-clientes.tsx`.
- [ ] **Step 3:** `bunx tsc --noEmit -p .` and `bunx eslint "app/(app)/analitica"` → clean.
- [ ] **Step 4: Browser check** (see Task 5).
- [ ] **Step 5:** `git add -A && git commit -m "feat(analitica): cobertura de clientes section with print and export"`

---

### Task 4: Documentation

**Files:** Modify `content/help/analitica-definiciones.md` — new "## Cobertura de clientes" section: window (12 calendar months ending this month), divisor rule (months with invoices), 30-day cutoff, "Sin datos" meaning, the four statuses including "Vende vía matriz", inactive default exclusion, SCD2 note (current name/seller, history by customer code).

- [ ] **Step 1:** Add the section. **Step 2:** `git commit -m "docs(analitica): define cobertura de clientes"`

---

### Task 5: End-to-end verification

- [ ] **Step 1:** Run the dev server (`bun dev`) with a logged-in admin; open `/analitica?tab=clientes`; confirm: rows with "Sin datos" first, sort toggle reverses, seller filter works, Imprimir produces one page per seller in print preview (Chrome headless print to PDF or the preview), Excel downloads and opens with the same filtered rows.
- [ ] **Step 2:** If any of this can't be exercised in the environment, say precisely which part was not verified.
