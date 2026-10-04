# Resumen: grouped KPIs, units, pendiente por cobrar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group Resumen's KPI boxes into coloured panels, add "Unidades vendidas" and "Pendiente por cobrar", and add a units column to "Desempeño por vendedor".

**Architecture:** Shared `KpiCard`/`KpiGroup` components in `app/(app)/analitica/components/`. `/api/dwh/resumen` gains `unitsSold`, `receivable` and per-seller `units`; the AR snapshot is resolved as "latest on or before the range end" via a new pure `rangeEndDateKey` helper.

**Tech Stack:** Next.js 16 App Router, mssql (DWH pool), Recharts, Tailwind, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-04-resumen-vendedores-units-and-kpi-groups-design.md`

**Execution order / dependencies:** PLAN 1 OF 5 — no dependencies. Plans 2 (Clientes), 3 (Ventas) and 4 (Devoluciones) consume `KpiCard`/`KpiGroup` from here only where they add KPI boxes (Devoluciones requires it; Clientes and Ventas may use it).
Build order for the whole initiative: **this plan → Clientes cobertura → Ventas → Devoluciones → CxC**.

## Global Constraints

- DWH only: queries use `getDwhPool()`; never ERP tables (AGENTS.md).
- Route gating via `requireDwhAccess(request)`; errors are `{ error: string }`.
- Ventas brutas = `SUM(Fact_Sales.NetAmount)`; units = `SUM(Fact_Sales.QuantitySold)`, `IsVoided = 0`.
- User-controlled values go through `.input()`; date ranges use existing `buildDateWhereClause` fragments (validated by regex) — the new snapshot bound is passed as `.input('rangeEndKey', ...)`.
- No date library; use plain `Date.UTC`.
- Spanish UI copy.

## Review Focus

- Range ending before the first snapshot: receivable is `null` ("Sin datos"), aging/top-debtor cards render empty state, no crash.
- Range `ytd:<past year>` / `month:<past>`: end key is the range's real last day, not today.
- `usd` null in some aging rows: receivable USD must be `null` only when no row has USD (not NaN).
- Seller with units = 0 / null `QuantitySold` sums: renders `0`, not `NaN`.
- KPI group renders when a value is `null` (shows "—"/"Sin datos").

## File Structure

- Create `app/(app)/analitica/components/kpi-card.tsx` — moved KpiCard (+delta/tone/subtitle).
- Create `app/(app)/analitica/components/kpi-group.tsx` — bordered/tinted grouping panel, closed tone set.
- Modify `app/api/dwh/lib/query-builder.ts` — add exported `rangeEndDateKey`.
- Create `app/api/dwh/lib/__tests__/range-end.test.ts`.
- Modify `app/(app)/analitica/lib/net-sales.ts` — add `sumDual`; test in `lib/__tests__/net-sales.test.ts`.
- Modify `app/api/dwh/resumen/route.ts`, `app/(app)/analitica/types.ts`, `app/(app)/analitica/tabs/tab-resumen.tsx`.
- Modify `content/help/analitica-definiciones.md`.

---

### Task 1: `rangeEndDateKey` helper

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts` (add near `buildDateWhereClause`, ~line 207; `dateKey()` helper at line 191, regexes `CUSTOM_RANGE_RE`/`MONTH_RANGE_RE`/`YTD_RANGE_RE` already defined in file)
- Test: `app/api/dwh/lib/__tests__/range-end.test.ts`

**Interfaces:**
- Produces: `export function rangeEndDateKey(dateRange: string, today: Date = new Date()): number` — the last day (YYYYMMDD int) covered by `buildDateWhereClause(dateRange)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { rangeEndDateKey } from '../query-builder';

const today = new Date(Date.UTC(2026, 9, 4)); // 2026-10-04

describe('rangeEndDateKey', () => {
  test('custom range ends on its end date', () => {
    expect(rangeEndDateKey('custom:2026-01-01:2026-02-15', today)).toBe(20260215);
  });
  test('month range ends on last day of that month (leap year)', () => {
    expect(rangeEndDateKey('month:2024-02', today)).toBe(20240229);
    expect(rangeEndDateKey('month:2026-09', today)).toBe(20260930);
  });
  test('current-year ytd ends today; past ytd ends Dec 31', () => {
    expect(rangeEndDateKey('ytd:2026', today)).toBe(20261004);
    expect(rangeEndDateKey('ytd:2025', today)).toBe(20251231);
  });
  test('30d, 12m and unknown values end today', () => {
    expect(rangeEndDateKey('30d', today)).toBe(20261004);
    expect(rangeEndDateKey('12m', today)).toBe(20261004);
    expect(rangeEndDateKey('garbage', today)).toBe(20261004);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test app/api/dwh/lib/__tests__/range-end.test.ts`
Expected: FAIL — `rangeEndDateKey` is not exported.

- [ ] **Step 3: Implement** (insert before `buildDateWhereClause`)

```ts
// Last calendar day covered by buildDateWhereClause(dateRange) as a YYYYMMDD
// int. '30d', '12m' and any unrecognised value are trailing windows ending today.
export function rangeEndDateKey(dateRange: string, today: Date = new Date()): number {
  const custom = CUSTOM_RANGE_RE.exec(dateRange);
  if (custom) return parseInt(custom[2].replace(/-/g, ''));
  const month = MONTH_RANGE_RE.exec(dateRange);
  if (month) {
    const year = parseInt(month[1]);
    const m = parseInt(month[2]);
    return dateKey(new Date(Date.UTC(year, m, 0)));
  }
  const ytd = YTD_RANGE_RE.exec(dateRange);
  if (ytd) {
    const year = parseInt(ytd[1]);
    return year === today.getUTCFullYear() ? dateKey(today) : year * 10000 + 1231;
  }
  return dateKey(today);
}
```

- [ ] **Step 4: Run to verify pass** — `bun test app/api/dwh/lib/__tests__/range-end.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add app/api/dwh/lib && git commit -m "feat(analitica): rangeEndDateKey helper"`

---

### Task 2: `sumDual` helper

**Files:**
- Modify: `app/(app)/analitica/lib/net-sales.ts`
- Test: `app/(app)/analitica/lib/__tests__/net-sales.test.ts` (create if absent)

**Interfaces:**
- Produces: `export function sumDual(items: DualAmount[]): DualAmount | null` — null for an empty list; `usd` is the sum of non-null USD values, `null` when every USD is null.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { sumDual } from '../net-sales';

describe('sumDual', () => {
  test('empty list is null', () => expect(sumDual([])).toBeNull());
  test('sums both currencies', () => {
    expect(sumDual([{ bs: 10, usd: 1 }, { bs: 20, usd: 2 }])).toEqual({ bs: 30, usd: 3 });
  });
  test('ignores null USD rows but keeps null when all are null', () => {
    expect(sumDual([{ bs: 10, usd: null }, { bs: 5, usd: 2 }])).toEqual({ bs: 15, usd: 2 });
    expect(sumDual([{ bs: 10, usd: null }])).toEqual({ bs: 10, usd: null });
  });
});
```

- [ ] **Step 2:** `bun test "app/(app)/analitica/lib/__tests__/net-sales.test.ts"` → FAIL.
- [ ] **Step 3: Implement** (append to `net-sales.ts`)

```ts
/** Sums BS/USD pairs. Null for no items; USD ignores null rows and is null only when all are null. */
export function sumDual(items: DualAmount[]): DualAmount | null {
  if (items.length === 0) return null;
  const withUsd = items.filter(i => i.usd !== null);
  return {
    bs: items.reduce((s, i) => s + i.bs, 0),
    usd: withUsd.length === 0 ? null : withUsd.reduce((s, i) => s + (i.usd as number), 0),
  };
}
```

- [ ] **Step 4:** run → PASS. **Step 5:** `git commit -m "feat(analitica): sumDual helper"`

---

### Task 3: Shared `KpiCard` and `KpiGroup`

**Files:**
- Create: `app/(app)/analitica/components/kpi-card.tsx`, `app/(app)/analitica/components/kpi-group.tsx`
- Modify: `app/(app)/analitica/tabs/tab-resumen.tsx` (remove local `KpiCard`, lines 34-58; import the shared one)

**Interfaces:**
- Produces:
  - `KpiCard({ label, value, tone?, delta?, subtitle?, title? })` — same props as today plus `subtitle?: string` (small gray line) and `title?: string` (tooltip).
  - `KpiGroup({ title, tone, children })`, `tone: 'sales' | 'returns' | 'collections' | 'customers'`.
  - `export type KpiTone`.

- [ ] **Step 1: Create `kpi-card.tsx`** (move the existing component, adding `subtitle`/`title`)

```tsx
export function KpiCard({
  label, value, tone, delta, subtitle, title,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
  delta?: { pct: number | null; label: string; goodDirection?: 'up' | 'down' };
  subtitle?: string;
  title?: string;
}) {
  const isGood =
    delta && delta.pct !== null && ((delta.goodDirection ?? 'up') === 'up' ? delta.pct >= 0 : delta.pct <= 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" title={title}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
      {subtitle && <p className="text-xs mt-1 text-gray-500">{subtitle}</p>}
      {delta && (
        <p className={`text-xs mt-1 font-medium ${delta.pct === null ? 'text-gray-400' : isGood ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct === null ? '—' : `${delta.pct >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct * 100).toFixed(1)}%`} {delta.label}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `kpi-group.tsx`**

```tsx
import type { ReactNode } from 'react';

export type KpiTone = 'sales' | 'returns' | 'collections' | 'customers';

const TONE_CLASSES: Record<KpiTone, { panel: string; title: string }> = {
  sales: { panel: 'border-blue-300 bg-blue-50/50', title: 'text-blue-700' },
  returns: { panel: 'border-red-300 bg-red-50/50', title: 'text-red-700' },
  collections: { panel: 'border-amber-300 bg-amber-50/50', title: 'text-amber-700' },
  customers: { panel: 'border-green-300 bg-green-50/50', title: 'text-green-700' },
};

export function KpiGroup({ title, tone, children }: { title: string; tone: KpiTone; children: ReactNode }) {
  const t = TONE_CLASSES[tone];
  return (
    <section className={`rounded-xl border-2 p-3 ${t.panel}`} aria-label={title}>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${t.title}`}>{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3:** In `tab-resumen.tsx` delete the local `KpiCard` and add `import { KpiCard } from '../components/kpi-card';` and `import { KpiGroup } from '../components/kpi-group';`.
- [ ] **Step 4:** `bunx tsc --noEmit -p .` → no new errors.
- [ ] **Step 5:** `git commit -m "feat(analitica): shared KpiCard and KpiGroup components"`

---

### Task 4: Resumen API — units, receivable, snapshot as of range end

**Files:**
- Modify: `app/api/dwh/resumen/route.ts`, `app/(app)/analitica/types.ts`

**Interfaces:**
- Consumes: `rangeEndDateKey` (Task 1), `sumDual` (Task 2).
- Produces: `ResumenKPIs.unitsSold: number`; `ResumenKPIs.receivable: DualAmount | null`; `SalesRepRow.units: number`; `ResumenResponse.snapshotDateKey` now means "snapshot used" (on or before range end).

- [ ] **Step 1: Types** — in `types.ts` add to `ResumenKPIs`:

```ts
  unitsSold: number; // SUM(Fact_Sales.QuantitySold) for the range, same scope as salesGross
  // Total outstanding AR (sum of aging buckets, credit notes excluded) at
  // ResumenResponse.snapshotDateKey — the latest snapshot on/before the range's
  // last day. Null when no snapshot exists on/before that day.
  receivable: DualAmount | null;
```

and to `SalesRepRow`: `units: number; // SUM(QuantitySold), same invoice scope as salesGross`.

- [ ] **Step 2: Route SQL**
  - Replace `LATEST_SNAPSHOT_QUERY` with:

```ts
const SNAPSHOT_AS_OF_QUERY = `
  SELECT MAX(SnapshotDateKey) AS SnapshotDateKey
  FROM fact.Fact_AR_Snapshot
  WHERE SnapshotDateKey <= @rangeEndKey
`;
```

  - In `GET`: `pool.request().input('rangeEndKey', rangeEndDateKey(dateRange)).query(SNAPSHOT_AS_OF_QUERY)`; import `rangeEndDateKey` from query-builder.
  - `totalsQuery`: add before `CollectedPeriodBs`:

```sql
      (SELECT ISNULL(SUM(fs.QuantitySold), 0) FROM fact.Fact_Sales fs
         WHERE fs.IsVoided = 0 ${salesDateWhere}) AS UnitsSold,
```

  - `salesRepQuery`: add `SUM(fs.QuantitySold) AS UnitsSold,` after the `dualAmountExpr(...)` line.
  - Mapping: `units: Number(r.UnitsSold ?? 0)` in `salesRepsMapped`; in `kpis` add `unitsSold: Number(totalsRow.UnitsSold ?? 0)` and `receivable: sumDual(agingBucketsMapped.map(b => b.amount))`. Add `UnitsSold: 0` to the fallback `totalsRow` default.

- [ ] **Step 3: Verify against the local DWH** (if `DWH_AlimentosNY` exists on localhost): write a throwaway `scratch` script via `bun -e` using `getDwhPool()` to run the two modified queries; confirm no SQL errors and that `UnitsSold` equals the Ventas route's `unitsSold` for the same range (`/api/dwh/ventas`). If the DWH is not present locally, skip and rely on typecheck + browser check in Task 6, stating so in the final report.
- [ ] **Step 4:** `bunx tsc --noEmit -p .` → clean.
- [ ] **Step 5:** `git commit -m "feat(analitica): resumen units sold, receivable at range end, per-seller units"`

---

### Task 5: Resumen UI — grouped KPIs and seller units column

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-resumen.tsx` (KPI row lines ~177-201; seller table ~314-351)

- [ ] **Step 1: Replace the KPI grid** with four groups (every existing KPI is kept exactly once):

```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KpiGroup title="Ventas" tone="sales">
          <KpiCard label={`Ventas brutas (${periodo})`} value={moneyLabel(data.kpis.salesGross, currency)} />
          <KpiCard label={`Ventas netas (${periodo})`} value={moneyLabel(data.kpis.salesNet, currency)} />
          <KpiCard
            label={`Unidades vendidas (${periodo})`}
            value={data.kpis.unitsSold.toLocaleString('es-VE')}
            title="Unidades facturadas, antes de devoluciones (misma definición que la pestaña Ventas)."
          />
        </KpiGroup>
        <KpiGroup title="Devoluciones" tone="returns">
          <KpiCard label={`Devoluciones (${periodo})`} value={moneyLabel(data.kpis.returns, currency)} />
          <KpiCard
            label="Tasa de devolución"
            value={pct(data.kpis.returnRate)}
            tone={data.kpis.returnRate !== null && data.kpis.returnRate > 0.05 ? 'warn' : 'default'}
          />
        </KpiGroup>
        <KpiGroup title="Cuentas por cobrar" tone="collections">
          <KpiCard label={`Cobrado (${periodo})`} value={moneyLabel(data.kpis.collected, currency)} />
          <KpiCard
            label="Pendiente por cobrar"
            value={data.kpis.receivable ? moneyLabel(data.kpis.receivable, currency) : 'Sin datos'}
            subtitle={data.snapshotDateKey !== null ? `al ${formatSnapshotDate(data.snapshotDateKey)}` : 'sin snapshot hasta el cierre del período'}
            title="Saldo pendiente total en el snapshot de CxC más reciente al último día del período seleccionado."
          />
        </KpiGroup>
        <KpiGroup title="Clientes" tone="customers">
          <KpiCard
            label="Clientes activos"
            value={data.kpis.activeCustomers.toLocaleString('es-VE')}
            delta={{ pct: activeCustomersDelta, label: 'vs. período anterior' }}
          />
          <KpiCard
            label="Tasa de abandono"
            value={pct(data.kpis.churnRate)}
            tone={data.kpis.churnRate !== null && data.kpis.churnRate > 0.2 ? 'warn' : 'default'}
          />
        </KpiGroup>
      </div>
```

- [ ] **Step 2: Seller table** — add after the "Ventas netas" `<th>`: `<th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unidades</th>` and in each row after the salesNet cell: `<td className="px-3 py-2 text-right text-gray-600">{r.units.toLocaleString('es-VE')}</td>`.
- [ ] **Step 3:** `bunx tsc --noEmit -p .` and `bunx eslint "app/(app)/analitica" app/api/dwh` → clean.
- [ ] **Step 4: Browser check** — use the `run` skill/`bun dev`; open `/analitica` (Resumen), confirm four coloured groups, units and receivable boxes, and the Unidades column. If the app can't authenticate/connect locally, state that it was not verified in a browser.
- [ ] **Step 5:** `git commit -m "feat(analitica): grouped KPI panels, units and receivable boxes on Resumen"`

---

### Task 6: Documentation

**Files:** Modify `content/help/analitica-definiciones.md` (new sections after "Ventas brutas").

- [ ] **Step 1:** Add:

```md
## Unidades vendidas

Suma de las cantidades facturadas (`QuantitySold`) en el período, sin anuladas y antes de devoluciones. Es la misma cifra que muestra la pestaña Ventas. En "Desempeño por vendedor" cuenta todas las facturas del vendedor, incluida la consignación.

## Pendiente por cobrar

Saldo total pendiente de cobro (todas las facturas con saldo, sin notas de crédito) según el snapshot de CxC más reciente **al último día del período seleccionado**. La tarjeta indica la fecha real del snapshot ("al 28/09/2026"). Si no existe un snapshot a esa fecha o antes, muestra "Sin datos". En USD se valora a la tasa de la fecha del snapshot.
```

- [ ] **Step 2:** `git commit -m "docs(analitica): define units sold and pendiente por cobrar"`
