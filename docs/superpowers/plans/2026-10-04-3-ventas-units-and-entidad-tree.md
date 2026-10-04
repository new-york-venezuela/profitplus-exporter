# Ventas: units trend, Entidad → tiendas → productos tree, units per line — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ventas trend chart defaults to units (with a Unidades/Dinero toggle); "Ventas por cliente" is a fixed Entidad table where every row expands to its tiendas and each tienda to its productos (same columns throughout, incl. units); "Ventas por línea" gets a units column.

**Architecture:** `/api/dwh/ventas` rows gain `units`; two new lazy child levels (`level=tienda`, `level=producto`) share filters with the top-level query and are built by pure SQL builders in `app/api/dwh/lib/ventas-children.ts`. A new `EntidadTreeTable` component renders the 3-level tree with per-node lazy loading; `GroupedDrilldownTable` stays untouched (Vendedores/Devoluciones use it).

**Tech Stack:** Next.js 16, mssql (DWH), Recharts, `bun test`.

**Spec:** `docs/superpowers/specs/2026-10-04-ventas-units-and-entidad-drilldown-design.md`

**Execution order / dependencies:** PLAN 3 OF 5. Depends on plan 1 only for conventions (`unitsSold` definition); no code dependency on plans 1-2. Plans 4 and 5 follow.

## Global Constraints

- DWH only; `requireDwhAccess`; errors `{ error: string }`; user input via `.input()`; date/bucket SQL fragments only from the existing regex-validated builders (`buildDateWhereClause`, `buildReturnsDateWhereClause`, `bucketFilterClause`).
- Units = `SUM(Fact_Sales.QuantitySold)`, `IsVoided = 0`; ventas brutas = `SUM(NetAmount)`; returns on the selected `returnsBasis` (`returnsDateColumn`).
- Tienda identity = `RTRIM(CustomerCode)` across all SCD2 versions; label = current version's name (`IsCurrent = 1`).
- Child rows are filtered by the fact customer's own `LegalEntityKey = @entityKey` — exactly the grain of the top-level Entidad row, so children always sum to their parent.
- Existing `breakdownBy`/`parentValue` API paths and `GroupedDrilldownTable` are unchanged.
- Spanish UI copy.

## Review Focus

- Entidad with a single store: still expandable; its one tienda equals the Entidad.
- Tienda/producto totals reconcile with the parent (ventas brutas, units, returns) for the same range/bucket/returns basis.
- Bucket drill (clicked bar) applies to the Entidad rows and to every child fetch.
- Units mode hides the net-of-returns line; Dinero mode is unchanged; default is Unidades; localStorage failure doesn't break rendering.
- Product with no returns/units: `0`, never `NaN`; `returnRate` null when no sales.
- Invalid `level`/`parentValue`/`entityKey` → 400 JSON, not a SQL error.

## File Structure

- Create `app/api/dwh/lib/ventas-rows.ts` — `mapVentasRecord(r, label)` shared row mapper. Test: `lib/__tests__/ventas-rows.test.ts`.
- Create `app/api/dwh/lib/ventas-children.ts` — `tiendasQuery`, `productosQuery`, `parseChildLevel`. Test: `lib/__tests__/ventas-children.test.ts`.
- Modify `app/api/dwh/ventas/route.ts`, `app/(app)/analitica/types.ts`.
- Create `app/(app)/analitica/components/entidad-tree-table.tsx`.
- Modify `app/(app)/analitica/tabs/tab-ventas.tsx`.
- Modify `content/help/analitica-definiciones.md`.

---

### Task 1: Shared row mapper (units-aware)

**Files:** Create `app/api/dwh/lib/ventas-rows.ts`; Test `app/api/dwh/lib/__tests__/ventas-rows.test.ts`.

**Interfaces:**
- Produces: `mapVentasRecord(r: Record<string, unknown>): Omit<VentasRow, 'label' | 'value' | 'title'>` reading `SalesGrossBs/Usd`, `ReturnsBs/Usd`, `GrossAmount`, `DiscountAmount`, `UnitsSold`.

- [ ] **Step 1: Failing test**

```ts
import { describe, test, expect } from 'bun:test';
import { mapVentasRecord } from '../ventas-rows';

describe('mapVentasRecord', () => {
  test('maps money, net, rate, discount and units', () => {
    const r = mapVentasRecord({
      SalesGrossBs: 1000, SalesGrossUsd: 10, ReturnsBs: 100, ReturnsUsd: 1,
      GrossAmount: 1250, DiscountAmount: 250, UnitsSold: 40,
    });
    expect(r.salesGross).toEqual({ bs: 1000, usd: 10 });
    expect(r.returns).toEqual({ bs: 100, usd: 1 });
    expect(r.salesNet).toEqual({ bs: 900, usd: 9 });
    expect(r.returnRate).toBeCloseTo(0.1);
    expect(r.avgDiscount).toBeCloseTo(0.2);
    expect(r.units).toBe(40);
  });
  test('missing units and zero sales give 0 and nulls, never NaN', () => {
    const r = mapVentasRecord({ SalesGrossBs: 0, SalesGrossUsd: null, ReturnsBs: 0, ReturnsUsd: 0, GrossAmount: 0, DiscountAmount: 0 });
    expect(r.units).toBe(0);
    expect(r.returnRate).toBeNull();
    expect(r.avgDiscount).toBeNull();
  });
});
```

- [ ] **Step 2:** `bun test app/api/dwh/lib/__tests__/ventas-rows.test.ts` → FAIL.
- [ ] **Step 3: Implement**

```ts
import { dualFromRow, returnRate, subtractDual } from '@/app/(app)/analitica/lib/net-sales';
import type { VentasRow } from '@/app/(app)/analitica/types';

export function mapVentasRecord(r: Record<string, unknown>): Omit<VentasRow, 'label' | 'value' | 'title'> {
  const salesGross = dualFromRow(r.SalesGrossBs, r.SalesGrossUsd);
  const returns = dualFromRow(r.ReturnsBs, r.ReturnsUsd);
  const grossAmount = Number(r.GrossAmount ?? 0);
  const discountAmount = Number(r.DiscountAmount ?? 0);
  return {
    salesGross,
    returns,
    salesNet: subtractDual(salesGross, returns),
    returnRate: returnRate(returns, salesGross),
    avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
    units: Number(r.UnitsSold ?? 0),
  };
}
```

- [ ] **Step 4:** Add `units: number; // SUM(QuantitySold)` to `VentasRow` in `types.ts` (run test → PASS). **Step 5:** commit `feat(analitica): ventas row mapper with units`.

---

### Task 2: Units in trend, cliente and línea queries

**Files:** Modify `app/api/dwh/ventas/route.ts` (`monthlyQuery` ~34, `clienteQuery` ~79, `lineaQuery` ~115, `lineaProductBreakdownQuery` ~142, row mapping ~565-581).

- [ ] **Step 1:** `monthlyQuery`: in `sales` CTE add `SUM(fs.QuantitySold) AS UnitsSold,` after `DiscountAmount`'s line (keeping commas valid), and in the final SELECT add `ISNULL(s.UnitsSold, 0) AS UnitsSold,`.
- [ ] **Step 2:** `clienteQuery` and `lineaQuery`: add `SUM(fs.QuantitySold) AS UnitsSold,` after the `DiscountAmount` line.
- [ ] **Step 3:** `lineaProductBreakdownQuery`: add `, SUM(fs.QuantitySold) AS UnitsSold` to the select list; in its JSON mapping add `units: Number(r.UnitsSold ?? 0)`. Do the same in the generic breakdown query (`breakdownSpec` branch, ~498) and its mapping.
- [ ] **Step 4:** Replace the inline row mapping with `...mapVentasRecord(r)`:

```ts
    const rows: VentasRow[] = recordset.map((r, i) => ({
      label: groupBy === 'mes' ? trendXLabels[i] : String(r.GroupLabel),
      ...(groupBy === 'mes' ? { title: bucketTitle(trendBucket.mode, String(r.GroupValue)) } : {}),
      value: r.GroupValue as string,
      ...mapVentasRecord(r),
    }));
```

(remove the now-unused imports `returnRate`/`subtractDual`/`dualFromRow` only if no longer referenced elsewhere in the file — `handleKpis` still uses them, so keep.)
- [ ] **Step 5:** `bunx tsc --noEmit -p .`; commit `feat(analitica): units in ventas trend, cliente and linea rows`.

---

### Task 3: Child levels (tiendas, productos)

**Files:** Create `app/api/dwh/lib/ventas-children.ts`; Test `app/api/dwh/lib/__tests__/ventas-children.test.ts`; Modify `ventas/route.ts`; Modify `types.ts`.

**Interfaces:**
- Produces: `type ChildLevel = 'tienda' | 'producto'`; `parseChildLevel(v: string | null): ChildLevel | null`; `tiendasQuery(f: ChildFilters): string`; `productosQuery(f: ChildFilters): string`; `interface ChildFilters { salesDateWhere: string; returnsDateWhere: string; salesBucketWhere: string; returnsBucketWhere: string; salesRepWhere: string; returnsSalesRepWhere: string }` — all fragments already validated; inputs `@entityKey` (int) and, for productos, `@storeCode` (varchar).
- Types: `VentasChildrenResponse { level: ChildLevel; rows: VentasRow[] }`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, test, expect } from 'bun:test';
import { parseChildLevel, tiendasQuery, productosQuery } from '../ventas-children';

const f = {
  salesDateWhere: 'AND fs.DateKey >= 1', returnsDateWhere: 'AND fr.OriginalInvoiceDateKey >= 1',
  salesBucketWhere: '', returnsBucketWhere: '', salesRepWhere: '', returnsSalesRepWhere: '',
};

describe('parseChildLevel', () => {
  test('accepts only tienda and producto', () => {
    expect(parseChildLevel('tienda')).toBe('tienda');
    expect(parseChildLevel('producto')).toBe('producto');
    expect(parseChildLevel('x; DROP TABLE')).toBeNull();
    expect(parseChildLevel(null)).toBeNull();
  });
});

describe('child queries', () => {
  test('tiendas filters by entity key parameter and groups by trimmed code across versions', () => {
    const q = tiendasQuery(f);
    expect(q).toContain('@entityKey');
    expect(q).toContain('RTRIM(c.CustomerCode)');
    expect(q).toContain('IsCurrent = 1');
    expect(q).not.toContain('CustomerKey AS GroupValue');
  });
  test('productos filters by entity and store code parameters', () => {
    const q = productosQuery(f);
    expect(q).toContain('@entityKey');
    expect(q).toContain('@storeCode');
    expect(q).toContain('QuantitySold');
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3: Implement `ventas-children.ts`**

```ts
import { usdConversionJoin, returnsUsdConversionJoin } from './query-builder';

export type ChildLevel = 'tienda' | 'producto';

export function parseChildLevel(v: string | null): ChildLevel | null {
  return v === 'tienda' || v === 'producto' ? v : null;
}

export interface ChildFilters {
  salesDateWhere: string;      // built against alias `fs`
  returnsDateWhere: string;    // built against alias `fr` on the selected returns column
  salesBucketWhere: string;    // '' or bucketFilterClause(..., 'fs')
  returnsBucketWhere: string;  // '' or bucketFilterClause(..., 'fr', returnsColumn)
  salesRepWhere: string;       // '' or 'AND fs.SalesRepKey = @salesRepKey'
  returnsSalesRepWhere: string; // '' or 'AND fr.SalesRepKey = @salesRepKey'
}

// Tiendas of one Entidad (@entityKey = LegalEntityKey of the fact's own
// customer version — the same grain as the top-level Entidad row, so children
// sum to their parent). A tienda is the trimmed CustomerCode across all SCD2
// versions; its label is the current version's name.
export function tiendasQuery(f: ChildFilters): string {
  return `
    WITH sales AS (
      SELECT RTRIM(c.CustomerCode) AS Code,
             SUM(fs.NetAmount) AS SalesGrossBs,
             SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesGrossUsd,
             SUM(fs.GrossAmount) AS GrossAmount,
             SUM(fs.DiscountAmount) AS DiscountAmount,
             SUM(fs.QuantitySold) AS UnitsSold
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey = @entityKey
        ${f.salesDateWhere} ${f.salesBucketWhere} ${f.salesRepWhere}
      GROUP BY RTRIM(c.CustomerCode)
    ),
    rets AS (
      SELECT RTRIM(c.CustomerCode) AS Code,
             SUM(fr.NetAmount) AS ReturnsBs,
             SUM(fr.NetAmount / NULLIF(frfx.RateSell, 0)) AS ReturnsUsd
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
      WHERE fr.IsVoided = 0 AND c.LegalEntityKey = @entityKey
        ${f.returnsDateWhere} ${f.returnsBucketWhere} ${f.returnsSalesRepWhere}
      GROUP BY RTRIM(c.CustomerCode)
    )
    SELECT s.Code AS GroupValue,
           ISNULL(cur.CustomerName, s.Code) AS GroupLabel,
           s.SalesGrossBs, s.SalesGrossUsd, s.GrossAmount, s.DiscountAmount, s.UnitsSold,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.Code IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s
    LEFT JOIN rets r ON r.Code = s.Code
    OUTER APPLY (
      SELECT TOP 1 c2.CustomerName FROM dim.Dim_Customer c2
      WHERE RTRIM(c2.CustomerCode) = s.Code AND c2.IsCurrent = 1
    ) cur
    ORDER BY s.SalesGrossBs DESC
  `;
}

// Productos of one tienda (@storeCode) within its Entidad (@entityKey).
export function productosQuery(f: ChildFilters): string {
  return `
    WITH sales AS (
      SELECT fs.ProductKey,
             SUM(fs.NetAmount) AS SalesGrossBs,
             SUM(fs.NetAmount / NULLIF(fx.RateSell, 0)) AS SalesGrossUsd,
             SUM(fs.GrossAmount) AS GrossAmount,
             SUM(fs.DiscountAmount) AS DiscountAmount,
             SUM(fs.QuantitySold) AS UnitsSold
      FROM fact.Fact_Sales fs
      ${usdConversionJoin('fs')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fs.CustomerKey
      WHERE fs.IsVoided = 0 AND c.LegalEntityKey = @entityKey AND RTRIM(c.CustomerCode) = @storeCode
        ${f.salesDateWhere} ${f.salesBucketWhere} ${f.salesRepWhere}
      GROUP BY fs.ProductKey
    ),
    rets AS (
      SELECT fr.ProductKey,
             SUM(fr.NetAmount) AS ReturnsBs,
             SUM(fr.NetAmount / NULLIF(frfx.RateSell, 0)) AS ReturnsUsd
      FROM fact.Fact_Returns fr
      ${returnsUsdConversionJoin('fr', 'frfx')}
      JOIN dim.Dim_Customer c ON c.CustomerKey = fr.CustomerKey
      WHERE fr.IsVoided = 0 AND c.LegalEntityKey = @entityKey AND RTRIM(c.CustomerCode) = @storeCode
        ${f.returnsDateWhere} ${f.returnsBucketWhere} ${f.returnsSalesRepWhere}
      GROUP BY fr.ProductKey
    )
    SELECT CAST(s.ProductKey AS varchar(20)) AS GroupValue,
           ISNULL(p.ProductName, p.ProductCode) AS GroupLabel,
           s.SalesGrossBs, s.SalesGrossUsd, s.GrossAmount, s.DiscountAmount, s.UnitsSold,
           ISNULL(r.ReturnsBs, 0) AS ReturnsBs,
           CASE WHEN r.ProductKey IS NULL THEN 0 ELSE r.ReturnsUsd END AS ReturnsUsd
    FROM sales s
    JOIN dim.Dim_Product p ON p.ProductKey = s.ProductKey
    LEFT JOIN rets r ON r.ProductKey = s.ProductKey
    ORDER BY s.SalesGrossBs DESC
  `;
}
```

- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Route wiring** — in `GET`, before the `breakdownBy && parentValue && groupByParam === 'linea'` branch (and inside the main `try`, after `clienteReturnsDateWhere`), add:

```ts
    const level = parseChildLevel(searchParams.get('level'));
    if (level) {
      const entityKeyParam = searchParams.get('entityKey');
      const storeCode = searchParams.get('storeCode');
      if (!entityKeyParam || !/^\d+$/.test(entityKeyParam) || (level === 'producto' && (!storeCode || storeCode.length > 16))) {
        return NextResponse.json({ error: 'Parámetros de desglose inválidos' }, { status: 400 });
      }
      const req = pool.request();
      req.input('entityKey', Number(entityKeyParam));
      if (level === 'producto') req.input('storeCode', (storeCode as string).trim());
      let salesBucketWhere = '';
      let returnsBucketWhere = '';
      if (bucketParam) {
        const s = bucketFilterClause(trendBucket.mode, bucketParam, 'fs');
        const r = bucketFilterClause(trendBucket.mode, bucketParam, 'fr', returnsColumn);
        if (s === null || r === null) return NextResponse.json({ error: 'Parámetro bucket inválido' }, { status: 400 });
        salesBucketWhere = s;
        returnsBucketWhere = r;
      }
      if (salesRepKey !== null) req.input('salesRepKey', salesRepKey);
      const filters = {
        salesDateWhere, returnsDateWhere, salesBucketWhere, returnsBucketWhere,
        salesRepWhere: salesRepKey !== null ? 'AND fs.SalesRepKey = @salesRepKey' : '',
        returnsSalesRepWhere: salesRepKey !== null ? 'AND fr.SalesRepKey = @salesRepKey' : '',
      };
      const result = await req.query(level === 'tienda' ? tiendasQuery(filters) : productosQuery(filters));
      const rows: VentasRow[] = result.recordset.map(r => ({
        label: String(r.GroupLabel).trim(),
        value: String(r.GroupValue).trim(),
        ...mapVentasRecord(r),
      }));
      const response: VentasChildrenResponse = { level, rows };
      return jsonWithCache(response);
    }
```

  Imports: `parseChildLevel, tiendasQuery, productosQuery` from `@/app/api/dwh/lib/ventas-children`; `mapVentasRecord` from `ventas-rows`; `VentasChildrenResponse` from types (add `export interface VentasChildrenResponse { level: 'tienda' | 'producto'; rows: VentasRow[] }`).
- [ ] **Step 6: Verify live** with a throwaway `bun test` (mock `@/lib/dwh/access`) that fetches the top Entidad (`groupBy=cliente`, `dateRange=12m`), then its tiendas, then the first tienda's productos, and asserts: sum of tienda `salesGross.bs` and `units` equals the Entidad row's (±0.01); sum of producto equals the tienda's; same for returns. Do not commit the scratch file.
- [ ] **Step 7:** commit `feat(analitica): ventas tiendas and productos child levels`.

---

### Task 4: Trend units/money toggle

**Files:** Modify `app/(app)/analitica/tabs/tab-ventas.tsx` (state ~214; `chartData` ~473; trend `ChartCard` ~639-666).

- [ ] **Step 1:** Add state `const [trendMetric, setTrendMetric] = useState<'units' | 'money'>('units');` plus an effect (try/catch) reading `localStorage['ventas-trend-metric']` once on mount and a setter wrapper `changeTrendMetric(next)` that also writes it (try/catch).
- [ ] **Step 2:** Extend `chartData` rows with `units: r.units`.
- [ ] **Step 3:** In the trend `ChartCard`, add a segmented control (same style as the returns-basis toggle: `role="group"`, `aria-pressed`) "Unidades | Dinero" above the chart. Chart: when `trendMetric === 'units'` render one `<Bar dataKey="units" name="Unidades vendidas" fill="#2563eb" ...same onClick>` and no `<Line>`; YAxis `tickFormatter={v => new Intl.NumberFormat('es-VE', { notation: 'compact' }).format(v)}` and Tooltip `formatter={val => new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(Number(val))}`; when `'money'` keep the current chart exactly. Subtitle switches: units → `Unidades facturadas por ${unit}, antes de devoluciones…`, money → existing text.
- [ ] **Step 4:** `bunx tsc --noEmit -p .`, `bunx eslint "app/(app)/analitica"`. **Step 5:** commit `feat(analitica): ventas trend defaults to units with money toggle`.

---

### Task 5: EntidadTreeTable and tab wiring (+ units column on línea)

**Files:** Create `app/(app)/analitica/components/entidad-tree-table.tsx`; Modify `tab-ventas.tsx`.

**Interfaces:**
- Consumes: `VentasRow`, `DrilldownColumn<VentasRow & {label;value}>` (from `grouped-drilldown-table.tsx`), `VentasChildrenResponse`.
- Produces: `export default function EntidadTreeTable({ rows, columns, fetchChildren }: { rows: VentasRow[]; columns: DrilldownColumn<VentasRow>[]; fetchChildren: (req: { level: 'tienda'; entityKey: string } | { level: 'producto'; entityKey: string; storeCode: string }) => Promise<VentasRow[]> })`.

- [ ] **Step 1: Implement the component.** Behaviour (exact):
  - Header cells: expander column, "Entidad", then `columns` (same as `GroupedDrilldownTable`: `col.title`, align classes).
  - Level 0 rows = `rows` (Entidad): button `aria-label="Ver tiendas"`/`"Ocultar tiendas"` always rendered (`▸`/`▾`). Expanding fetches `{ level: 'tienda', entityKey: row.value }` once (cache `Record<string, Node>` keyed `e:${entityKey}`), showing "Cargando tiendas…" while loading, "Sin tiendas con ventas en el período." on empty and an error line with a "Reintentar" button on failure.
  - Level 1 rows (tienda) render with the same `columns` cells, indented (`pl-8`), lighter background (`bg-gray-50`), label shows the name with the code small underneath; each has its own expander ("Ver productos") fetching `{ level: 'producto', entityKey, storeCode: tienda.value }`, cache key `t:${entityKey}:${storeCode}`.
  - Level 2 rows (producto) same cells, `pl-14`, `bg-gray-100/60`, no expander.
  - Every cell uses `col.format(row)`, so children use exactly the parent's columns/units/currency.
  - Row/column keys unique per level; `<Fragment>` per row.
  - Empty top-level: "Sin datos disponibles todavía." row.
- [ ] **Step 2: Wire into the tab:**
  - Delete `CLIENTE_GROUP_BY_OPTIONS`, `BREAKDOWN_BY_OPTIONS`, the `clienteDimension`/`breakdownBy` state and `handleFetchBreakdown`; the cliente fetch always sends `clienteDimension: 'cliente_entidad'`.
  - New `handleFetchChildren(req)` building `URLSearchParams({ dateRange, groupBy: 'cliente', level, entityKey, [storeCode], granularity, returnsBasis })` plus `bucket` when set; returns `body.rows ?? []`, throwing on `!res.ok` (so the tree shows its error/retry).
  - Replace the `<GroupedDrilldownTable ... clienteColumns>` block with `<EntidadTreeTable key={`${dateRange}|${granularity}|${bucket ?? ''}|${returnsBasis}`} rows={clienteTableRows} columns={clienteColumns} fetchChildren={handleFetchChildren} />`.
  - Add the units column to `moneyColumns` after `salesNet`: `{ key: 'units', label: 'Unidades', align: 'right', title: 'Unidades facturadas, antes de devoluciones.', format: row => row.units.toLocaleString('es-VE') }`.
  - Línea table: the breakdown formatter currently renders every metric as money; replace both `formatBreakdownMetric` props for the línea table with:

```ts
formatBreakdownMetric={(key, _value, row) => key === 'units'
  ? Number(row.units ?? 0).toLocaleString('es-VE')
  : formatBreakdownMoney(row, currency)}
```

  and make sure the línea product breakdown JSON (Task 2) includes `units`.
- [ ] **Step 3:** `bunx tsc --noEmit -p .`; `bunx eslint "app/(app)/analitica"`. **Step 4:** commit `feat(analitica): Entidad → tiendas → productos tree on Ventas`.

---

### Task 6: Docs and live verification

- [ ] **Step 1:** In `content/help/analitica-definiciones.md` add a short "## Ventas por cliente" note: the table is always grouped by Entidad; expand to tiendas and each tienda to productos; children use the same columns and add up to their parent; trend chart defaults to units.
- [ ] **Step 2:** Run the live reconciliation scratch test from Task 3 step 6 across two ranges (`12m`, `month:2026-06`) and with `returnsBasis=devolucion`.
- [ ] **Step 3:** Browser check (`bun dev`): toggle default is Unidades; expand an Entidad → tiendas → productos; línea table shows Unidades. State precisely anything not verified.
- [ ] **Step 4:** commit `docs(analitica): ventas tree and units definitions`.
