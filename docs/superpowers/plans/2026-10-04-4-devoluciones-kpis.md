# Devoluciones: headline KPI boxes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On entering Devoluciones, show two groups of KPI boxes (magnitude; where it happens) above the existing tables.

**Architecture:** New `section=kpis` on `/api/dwh/devoluciones` runs four small queries (totals, top product, top entidad, per-seller returns vs sales) and a pure helper picks the worst seller by rate above a minimum-sales share. UI renders them with `KpiGroup`/`KpiCard` from plan 1.

**Tech Stack:** Next.js 16, mssql (DWH), `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-04-devoluciones-kpis-design.md`

**Execution order / dependencies:** PLAN 4 OF 5. **Depends on plan 1** (`components/kpi-card.tsx`, `kpi-group.tsx`). Plan 5 (CxC) follows and is independent of this one.

## Spec deviation (decided during planning)

The spec proposed the rate on the factura basis. This tab's own definition (shown in its header text and used by every table below) is **returns by devolución date ÷ ventas brutas of the same range**. All KPIs here use that single convention so the boxes agree with the tables beneath them; the tooltips say so, and the note that Resumen/Ventas net returns by factura date stays in the tab header. USD converts at the original factura's rate (`returnsUsdConversionJoin`), as everywhere else.

## Global Constraints

- DWH only; `requireDwhAccess`; errors `{ error: string }`; dates only via `buildDateWhereClause(dateRange, alias)` (devolución date = `DateKey`).
- Returns = `fact.Fact_Returns` `IsVoided = 0`; amount `NetAmount`; units `QuantityReturned`; credit notes `COUNT(DISTINCT CreditNoteNumber)`.
- Ventas brutas denominator = `SUM(Fact_Sales.NetAmount)` and units `SUM(QuantitySold)`, `IsVoided = 0`, same range.
- Top-seller rule: only sellers whose ventas brutas ≥ `MIN_SELLER_SALES_SHARE` (1%) of the period's total ventas brutas compete; constant is exported and tested.
- Empty range: every "top" box is `null` ("Sin datos"), rates `null` ("—"), counts 0 — never `NaN`.

## Review Focus

- Range with no returns: all KPI values null/0, no crash, boxes show "Sin datos"/"—".
- Range with returns but zero sales: rates are `null`, not `Infinity`.
- A seller with 1 tiny invoice and a big return (100% rate) must NOT win "mayor tasa".
- Returns with no seller / no product resolve to a label ("Sin vendedor"/code), not null names.
- USD null (missing rate) renders "—" via `moneyLabel`.

## File Structure

- Create `app/(app)/analitica/lib/devoluciones-kpis.ts` (pure) + `lib/__tests__/devoluciones-kpis.test.ts`.
- Modify `app/(app)/analitica/types.ts`, `app/api/dwh/devoluciones/route.ts`, `app/(app)/analitica/tabs/tab-devoluciones.tsx`, `content/help/analitica-definiciones.md`.

---

### Task 1: Pure KPI helpers

**Files:** Create `app/(app)/analitica/lib/devoluciones-kpis.ts`; Test `app/(app)/analitica/lib/__tests__/devoluciones-kpis.test.ts`.

**Interfaces:**
- Produces: `MIN_SELLER_SALES_SHARE = 0.01`; `safeRatio(n: number, d: number): number | null` (null when `d <= 0`); `pickTopSellerByRate(rows: { name: string; returnsBs: number; salesBs: number }[], totalSalesBs: number): { name: string; rate: number; returnsBs: number } | null`.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { MIN_SELLER_SALES_SHARE, safeRatio, pickTopSellerByRate } from '../devoluciones-kpis';

describe('safeRatio', () => {
  test('null for non-positive denominators', () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(safeRatio(5, -1)).toBeNull();
    expect(safeRatio(5, 100)).toBeCloseTo(0.05);
  });
});

describe('pickTopSellerByRate', () => {
  test('ignores sellers below the minimum sales share', () => {
    const rows = [
      { name: 'Tiny', returnsBs: 90, salesBs: 90 },       // 100% but 0.09% of sales
      { name: 'Big', returnsBs: 50, salesBs: 500 },       // 10%
      { name: 'Mid', returnsBs: 20, salesBs: 400 },       // 5%
    ];
    const r = pickTopSellerByRate(rows, 100_000);
    expect(MIN_SELLER_SALES_SHARE).toBe(0.01);
    expect(r).toBeNull(); // nobody reaches 1% of 100k
    const r2 = pickTopSellerByRate(rows, 1_000);
    expect(r2?.name).toBe('Big');
    expect(r2?.rate).toBeCloseTo(0.1);
  });
  test('null with no qualifying seller or no sales', () => {
    expect(pickTopSellerByRate([], 1000)).toBeNull();
    expect(pickTopSellerByRate([{ name: 'A', returnsBs: 1, salesBs: 10 }], 0)).toBeNull();
  });
  test('sellers with zero returns do not win', () => {
    expect(pickTopSellerByRate([{ name: 'A', returnsBs: 0, salesBs: 500 }], 1000)).toBeNull();
  });
});
```

- [ ] **Step 2:** run → FAIL. **Step 3: Implement**

```ts
export const MIN_SELLER_SALES_SHARE = 0.01;

export function safeRatio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

// Highest return rate among sellers that carry at least MIN_SELLER_SALES_SHARE
// of the period's ventas brutas (so a one-invoice seller can't win at 100%).
export function pickTopSellerByRate(
  rows: { name: string; returnsBs: number; salesBs: number }[],
  totalSalesBs: number,
): { name: string; rate: number; returnsBs: number } | null {
  if (totalSalesBs <= 0) return null;
  let best: { name: string; rate: number; returnsBs: number } | null = null;
  for (const r of rows) {
    if (r.returnsBs <= 0 || r.salesBs < totalSalesBs * MIN_SELLER_SALES_SHARE) continue;
    const rate = r.returnsBs / r.salesBs;
    if (!best || rate > best.rate) best = { name: r.name, rate, returnsBs: r.returnsBs };
  }
  return best;
}
```

- [ ] **Step 4:** run → PASS. **Step 5:** commit `feat(analitica): devoluciones KPI helpers`.

---

### Task 2: Types and API `section=kpis`

**Files:** Modify `types.ts` (append), `app/api/dwh/devoluciones/route.ts`.

**Interfaces:**
- Produces: `DevolucionesKpis` and `DevolucionesKpisResponse { kpis: DevolucionesKpis }`:

```ts
export interface DevolucionesKpis {
  returnsNet: DualAmount;
  returnRate: number | null;       // returns ÷ ventas brutas, same range, BS side
  unitsReturned: number;
  unitsReturnRate: number | null;  // unitsReturned ÷ unitsSold
  creditNotes: number;
  avgCreditNote: DualAmount | null;
  topProduct: { name: string; amount: DualAmount } | null;
  topCustomer: { name: string; amount: DualAmount } | null;   // by Entidad
  topSellerByRate: { name: string; rate: number; amount: DualAmount } | null;
}
```

- [ ] **Step 1: Queries** (add to the route; `fr`/`fs` aliases; `returnsDateWhere = buildDateWhereClause(dateRange, 'fr')`, `salesDateWhere = buildDateWhereClause(dateRange, 'fs')`):

```ts
const KPI_TOTALS_QUERY = (returnsWhere: string, salesWhere: string) => `
  SELECT
    (SELECT ISNULL(SUM(fr.NetAmount), 0) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS ReturnsBs,
    (SELECT CASE WHEN COUNT(fr.NetAmount) = 0 THEN 0 ELSE SUM(fr.NetAmount / NULLIF(rfx.RateSell, 0)) END
       FROM fact.Fact_Returns fr ${returnsUsdConversionJoin('fr', 'rfx')} WHERE fr.IsVoided = 0 ${returnsWhere}) AS ReturnsUsd,
    (SELECT ISNULL(SUM(fr.QuantityReturned), 0) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS UnitsReturned,
    (SELECT COUNT(DISTINCT fr.CreditNoteNumber) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0 ${returnsWhere}) AS CreditNotes,
    (SELECT ISNULL(SUM(fs.NetAmount), 0) FROM fact.Fact_Sales fs WHERE fs.IsVoided = 0 ${salesWhere}) AS SalesBs,
    (SELECT ISNULL(SUM(fs.QuantitySold), 0) FROM fact.Fact_Sales fs WHERE fs.IsVoided = 0 ${salesWhere}) AS UnitsSold
`;

const KPI_TOP_PRODUCT_QUERY = (returnsWhere: string) => `
  SELECT TOP 1 ISNULL(p.ProductName, p.ProductCode) AS Name,
    ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
  FROM fact.Fact_Returns fr
  ${returnsUsdConversionJoin('fr')}
  JOIN dim.Dim_Product p ON p.ProductKey = fr.ProductKey
  WHERE fr.IsVoided = 0 ${returnsWhere}
  GROUP BY fr.ProductKey, ISNULL(p.ProductName, p.ProductCode)
  ORDER BY AmountBs DESC
`;

function kpiTopEntidadQuery(returnsWhere: string): string {
  const spec = getDimensionSpec('cliente_entidad');
  return `
    SELECT TOP 1 ${spec.labelExpr} AS Name,
      ${dualAmountExpr('fr', 'NetAmount', 'AmountBs', 'AmountUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    ${spec.joinClause.replace(/\bf\b/g, 'fr')}
    WHERE fr.IsVoided = 0 ${returnsWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY AmountBs DESC
  `;
}

// Every seller with returns in the range, with their ventas brutas in the same
// range (sales aggregated in its own CTE — no correlated subquery on a grouped alias).
const KPI_SELLERS_QUERY = (returnsWhere: string, salesWhere: string) => `
  WITH rets AS (
    SELECT fr.SalesRepKey, ${dualAmountExpr('fr', 'NetAmount', 'ReturnsBs', 'ReturnsUsd')}
    FROM fact.Fact_Returns fr
    ${returnsUsdConversionJoin('fr')}
    WHERE fr.IsVoided = 0 ${returnsWhere}
    GROUP BY fr.SalesRepKey
  ),
  sales AS (
    SELECT fs.SalesRepKey, SUM(fs.NetAmount) AS SalesBs
    FROM fact.Fact_Sales fs
    WHERE fs.IsVoided = 0 ${salesWhere}
    GROUP BY fs.SalesRepKey
  )
  SELECT ISNULL(r.SalesRepName, ISNULL(r.SalesRepCode, 'Sin vendedor')) AS Name,
         rt.ReturnsBs, rt.ReturnsUsd, ISNULL(s.SalesBs, 0) AS SalesBs
  FROM rets rt
  LEFT JOIN sales s ON s.SalesRepKey = rt.SalesRepKey
  LEFT JOIN dim.Dim_SalesRep r ON r.SalesRepKey = rt.SalesRepKey
`;
```

- [ ] **Step 2: Handler** — in `GET`, when `searchParams.get('section') === 'kpis'`, run the four queries in `Promise.all` and map:

```ts
const t = totals.recordset[0];
const returnsNet = { bs: Number(t.ReturnsBs), usd: t.ReturnsUsd === null ? null : Number(t.ReturnsUsd) };
const creditNotes = Number(t.CreditNotes);
const salesBs = Number(t.SalesBs);
const sellerRows = sellers.recordset.map(r => ({ name: String(r.Name), returnsBs: Number(r.ReturnsBs), returnsUsd: r.ReturnsUsd === null ? null : Number(r.ReturnsUsd), salesBs: Number(r.SalesBs) }));
const top = pickTopSellerByRate(sellerRows, salesBs);
const topSellerRow = top ? sellerRows.find(r => r.name === top.name) : undefined;
const named = (rs: { recordset: any[] }) => rs.recordset[0] ? { name: String(rs.recordset[0].Name).trim(), amount: { bs: Number(rs.recordset[0].AmountBs), usd: rs.recordset[0].AmountUsd === null ? null : Number(rs.recordset[0].AmountUsd) } } : null;
const kpis: DevolucionesKpis = {
  returnsNet,
  returnRate: safeRatio(returnsNet.bs, salesBs),
  unitsReturned: Number(t.UnitsReturned),
  unitsReturnRate: safeRatio(Number(t.UnitsReturned), Number(t.UnitsSold)),
  creditNotes,
  avgCreditNote: creditNotes > 0 ? { bs: returnsNet.bs / creditNotes, usd: returnsNet.usd === null ? null : returnsNet.usd / creditNotes } : null,
  topProduct: named(topProduct),
  topCustomer: named(topEntidad),
  topSellerByRate: top && topSellerRow ? { name: top.name, rate: top.rate, amount: { bs: topSellerRow.returnsBs, usd: topSellerRow.returnsUsd } } : null,
};
return jsonWithCache({ kpis });
```

  Put this handling inside the existing `try` right after `salesDateWhere` is computed but build `salesDateWhere` against `fs` for this branch (`buildDateWhereClause(dateRange, 'fs')`).
- [ ] **Step 3: Verify live** with a throwaway `bun test` (mock `@/lib/dwh/access`): call `section=kpis` for `12m`, `month:2026-06` and `ytd:2025` (no data); assert `returnsNet.bs` equals the sum of the salesrep matrix rows' `amountNet.bs` for the same range when that matrix has < 50 rows, rates in [0,1], and the empty range gives nulls/0. Not committed.
- [ ] **Step 4:** `bunx tsc --noEmit -p .`. **Step 5:** commit `feat(analitica): devoluciones KPI endpoint`.

---

### Task 3: UI

**Files:** Modify `app/(app)/analitica/tabs/tab-devoluciones.tsx` (insert after the header `<div>` at the top of the returned JSX, line ~318).

- [ ] **Step 1:** State `kpisData/kpisLoading/kpisError` + a cancellable effect keyed on `[dateRange]` fetching `/api/dwh/devoluciones?dateRange=…&section=kpis` (same pattern as the other panels).
- [ ] **Step 2:** Render (loading: "Cargando…", error: red box) two groups:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <KpiGroup title="Magnitud" tone="returns">
    <KpiCard label="Devoluciones netas" value={moneyLabel(k.returnsNet, currency)} title="Notas de crédito del período (por fecha de devolución), sin IVA." />
    <KpiCard label="Tasa de devolución" value={pct(k.returnRate)} tone={k.returnRate !== null && k.returnRate > 0.05 ? 'warn' : 'default'} title="Devoluciones ÷ ventas brutas del mismo período." />
    <KpiCard label="Unidades devueltas" value={k.unitsReturned.toLocaleString('es-VE')} subtitle={k.unitsReturnRate !== null ? `${pct(k.unitsReturnRate)} de las unidades vendidas` : undefined} />
    <KpiCard label="Notas de crédito" value={k.creditNotes.toLocaleString('es-VE')} subtitle={k.avgCreditNote ? `prom. ${moneyLabel(k.avgCreditNote, currency)}` : undefined} />
  </KpiGroup>
  <KpiGroup title="Dónde ocurre" tone="collections">
    <KpiCard label="Producto más devuelto" value={k.topProduct?.name ?? 'Sin datos'} subtitle={k.topProduct ? moneyLabel(k.topProduct.amount, currency) : undefined} />
    <KpiCard label="Cliente con más devoluciones" value={k.topCustomer?.name ?? 'Sin datos'} subtitle={k.topCustomer ? moneyLabel(k.topCustomer.amount, currency) : undefined} title="Por Entidad (cadena / razón social)." />
    <KpiCard label="Mayor tasa por vendedor" value={k.topSellerByRate?.name ?? 'Sin datos'} subtitle={k.topSellerByRate ? `${pct(k.topSellerByRate.rate)} · ${moneyLabel(k.topSellerByRate.amount, currency)}` : undefined} title="Solo vendedores con al menos 1% de las ventas brutas del período." />
  </KpiGroup>
</div>
```

  where `k = kpisData.kpis`. Long names must not break the grid: `KpiCard` value uses `text-2xl`; for the text-valued cards pass through a `value` that is truncated with CSS — add an optional `valueClassName` prop to `KpiCard` (default `text-2xl font-bold`) and use `text-base font-bold` + `break-words` for the three name cards.
- [ ] **Step 3:** `bunx tsc --noEmit -p .`; `bunx eslint "app/(app)/analitica"`. **Step 4:** commit `feat(analitica): headline KPI boxes on Devoluciones`.

---

### Task 4: Docs

- [ ] **Step 1:** In `content/help/analitica-definiciones.md`, under "## Devoluciones" add the KPI definitions (devolución date basis; tasa = devoluciones ÷ ventas brutas del mismo período; top seller needs ≥1% of sales; unidades). **Step 2:** commit `docs(analitica): devoluciones KPIs`.
