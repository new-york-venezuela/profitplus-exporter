# Analítica UI Flattening, Finanzas Margin Rework, CxC Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten three Analítica tabs' hidden view-selectors into always-visible stacked sections, add HTTP caching to every DWH API route, restructure the Finanzas waterfall around a Compras-proxy gross margin, add due-date lineage to `Fact_Collections` and four new CxC charts/columns, and correct stale DWH-guide documentation — all TDD, matching this codebase's existing plan conventions.

**Architecture:** Part 1 changes three tab components from "one visible section chosen by a button toggle" to "three sections rendered simultaneously, each fetching its own `groupBy` slice in parallel," and adds a `Cache-Control` header to all 11 `app/api/dwh/*/route.ts` handlers. Part 2 reuses `dwh.vw_GastosOperativos`'s existing Compras/non-Compras split (no new SQL) to add two proxy waterfall steps to `finanzas/route.ts` and `tab-finanzas.tsx`. Part 3 adds a `DueDateKey` column to `fact.Fact_Collections` (new migration `0027`, sourced from the same `saDocumentoVenta.fec_venc` column `Fact_AR_Snapshot.DueDate` already uses), then adds four read-only query/UI additions to `cxc/route.ts` and `tab-cxc.tsx`. Part 4 removes now-dead code and fixes two stale "wired to auto-populate" doc claims.

**Tech Stack:** SQL Server (T-SQL migrations under `dwh-migrations/`), Next.js API routes, React, Recharts, `bun:test`, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md`

## Global Constraints

- Never edit an existing numbered migration file — every change is a new file. The next free number is `0027` (highest existing is `0026_gastos_operativos_view.sql`).
- Every migration must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER`), multi-batch DDL separated by a line containing only `GO` — see `dwh-migrations/README.md`.
- The local DWH is a shared SQL Server instance — run DWH-touching test files one at a time (`bun test path/to/one.test.ts --env-file=.env.local`), never the full `bun run test` batch (lock contention, a known pre-existing environment characteristic).
- Every `app/api/dwh/*/route.ts` handler's `GET` function must end by returning `NextResponse.json(response)` (or an early-return breakdown branch) exactly as today — Part 1's Cache-Control task only adds a header, it must not change any route's response body shape.
- `PivotDimension`/`GroupBy` stay `string`-typed aliases (`app/(app)/analitica/types.ts:6-7`) — do not introduce a new enum type where a string literal union already works, matching this codebase's existing style.
- Money values are always rendered via `moneyLabel`/`money`/`moneyTooltip` from `app/(app)/analitica/lib/format.ts` — never a raw `toLocaleString()` in new tab code (this codebase has a documented regression class for exactly that bug, guarded by e2e tests in `e2e/analitica.spec.ts`).
- New percentage fields follow the existing `number | null` convention (`null` when the denominator is 0), rendered with each tab's existing local `pct()` helper — never a hardcoded `0%` fallback.
- Route handler files (`route.ts`) under the Next.js App Router may only export whitelisted names (`GET`, `POST`, `dynamic`, etc.) — any pure-computation helper that needs its own unit test must live in a separate, non-route file and be imported into `route.ts`, never exported directly from `route.ts` itself.
- If a shell `git` command in a worktree hits a safety-check false positive on plain `git`, prefix with `command git`.
- No schema/ETL changes to `Fact_Sales` cost columns, no Productos tab changes, no Nómina cost-center changes — all explicitly out of scope per the spec.

## File Structure

**New files:**

```
dwh-migrations/
  0027_fact_collections_due_date.sql   ← DueDateKey column + Load_Fact_Collections update
scripts/dwh/__tests__/
  fact-collections-due-date.test.ts    ← DWH-level test for 0027
app/api/dwh/finanzas/
  margen-proxy.ts                       ← computeMargenProxy, imported by route.ts
app/api/dwh/finanzas/__tests__/
  margen-proxy.test.ts                  ← unit test for computeMargenProxy
docs/superpowers/plans/
  2026-09-15-analitica-ui-and-margin-plan.md  ← this file
```

**Modified files (grouped by part):**

```
Part 1 — flatten + caching
  app/(app)/analitica/tabs/tab-ventas.tsx
  app/(app)/analitica/tabs/tab-compras.tsx
  app/(app)/analitica/tabs/tab-devoluciones.tsx
  app/api/dwh/lib/query-builder.ts
  app/api/dwh/lib/__tests__/query-builder.test.ts
  app/api/dwh/clientes/route.ts
  app/api/dwh/compras/route.ts
  app/api/dwh/cxc/route.ts
  app/api/dwh/dashboard/route.ts
  app/api/dwh/devoluciones/route.ts
  app/api/dwh/finanzas/route.ts
  app/api/dwh/multimoneda/route.ts
  app/api/dwh/productos/route.ts
  app/api/dwh/resumen/route.ts
  app/api/dwh/vendedores/route.ts
  app/api/dwh/ventas/route.ts
  app/api/dwh/finanzas/__tests__/route.test.ts

Part 2 — Finanzas margin proxy
  app/api/dwh/finanzas/route.ts
  app/api/dwh/finanzas/margen-proxy.ts (new)
  app/(app)/analitica/tabs/tab-finanzas.tsx
  app/(app)/analitica/types.ts

Part 3 — CxC expansion
  dwh-migrations/0027_fact_collections_due_date.sql (new)
  app/api/dwh/cxc/route.ts
  app/(app)/analitica/tabs/tab-cxc.tsx
  app/(app)/analitica/types.ts

Part 4 — cleanup
  app/api/dwh/finanzas/route.ts
  app/(app)/analitica/tabs/tab-finanzas.tsx
  app/(app)/analitica/types.ts
  app/(app)/analitica/tabs/tab-ventas.tsx
  app/(app)/analitica/tabs/tab-compras.tsx
  app/(app)/analitica/tabs/tab-devoluciones.tsx
  docs/DATA_WAREHOUSE_GUIDE.md
  dwh-migrations/README.md
  docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md

Testing (throughout)
  e2e/analitica.spec.ts
```

---

## Task 1: `jsonWithCache` helper + Cache-Control on every DWH route

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts`
- Test: `app/api/dwh/lib/__tests__/query-builder.test.ts`
- Modify: `app/api/dwh/clientes/route.ts`, `app/api/dwh/compras/route.ts`, `app/api/dwh/cxc/route.ts`, `app/api/dwh/dashboard/route.ts`, `app/api/dwh/devoluciones/route.ts`, `app/api/dwh/finanzas/route.ts`, `app/api/dwh/multimoneda/route.ts`, `app/api/dwh/productos/route.ts`, `app/api/dwh/resumen/route.ts`, `app/api/dwh/vendedores/route.ts`, `app/api/dwh/ventas/route.ts`
- Test: `app/api/dwh/finanzas/__tests__/route.test.ts` (already exists — extended)

**Interfaces:**
- Produces: `jsonWithCache<T>(body: T, init?: ResponseInit): NextResponse` in `query-builder.ts` — a thin wrapper around `NextResponse.json` that always sets `Cache-Control: private, max-age=900` on the response, in addition to any headers the caller passes via `init`. Every route's successful-response call sites (`return NextResponse.json(response)` and every `return NextResponse.json({ breakdown: ... })` early-return branch) switch to this helper; every route's `catch` block's error response (`NextResponse.json({ error: ... }, { status: 500 })`) is deliberately left calling `NextResponse.json` directly, unchanged — errors must never be cached.
- Consumes: nothing new — `NextResponse` from `next/server`, already imported everywhere.

- [ ] **Step 1: Write the failing test for `jsonWithCache`**

In `app/api/dwh/lib/__tests__/query-builder.test.ts`, add the import and a new `describe` block:

```typescript
import { getDimensionSpec, isDimension, isDimensionForFact, isClienteDimension, buildDateWhereClause, jsonWithCache } from '../query-builder';

// ... (existing describe blocks unchanged) ...

describe('jsonWithCache', () => {
  test('sets Cache-Control: private, max-age=900 on the response', () => {
    const res = jsonWithCache({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
  });

  test('still serializes the given body as JSON', async () => {
    const res = jsonWithCache({ foo: 'bar', n: 42 });
    const body = await res.json();
    expect(body).toEqual({ foo: 'bar', n: 42 });
  });

  test('preserves a caller-supplied status via init', () => {
    const res = jsonWithCache({ ok: true }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=900');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: FAIL — `jsonWithCache` is not exported yet (`TypeError: jsonWithCache is not a function` or an import error).

- [ ] **Step 3: Implement `jsonWithCache` in `query-builder.ts`**

Add this import and function near the top of `app/api/dwh/lib/query-builder.ts` (after the existing `getDwhPool` import):

```typescript
import { NextResponse } from 'next/server';
```

Add the function anywhere after the existing imports (e.g. directly above `export async function getUsdRate`):

```typescript
// Every Analítica tab now renders its full report immediately on tab-mount
// (Part 1 of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md
// — no more hidden-until-toggled sections), so every dwh/* route's success
// response should carry a short private HTTP cache window: 15 minutes is
// long enough to dedupe the burst of near-simultaneous requests a single
// tab-mount now fires (one per stacked section) and short enough that a
// user won't see meaningfully stale data. `private` (not `public`) because
// responses are gated by requireDwhAccess and must never be cached by a
// shared/proxy cache. Error responses (500s from a route's catch block)
// intentionally do NOT go through this helper — call NextResponse.json
// directly for those, so a transient DB error is never cached. This header
// is independent of each route's `export const dynamic = 'force-dynamic'`
// — that only disables Next.js's own server-side route-segment cache (no
// ISR/static generation); it does not touch the Cache-Control header sent
// to the browser, so this header reaches the client as intended.
export function jsonWithCache<T>(body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, max-age=900');
  return response;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test app/api/dwh/lib/__tests__/query-builder.test.ts`
Expected: PASS (all tests, including the pre-existing `getDimensionSpec`/`buildDateWhereClause` ones).

- [ ] **Step 5: Commit the helper**

```bash
git add app/api/dwh/lib/query-builder.ts app/api/dwh/lib/__tests__/query-builder.test.ts
git commit -m "feat: add jsonWithCache helper for DWH API response caching"
```

- [ ] **Step 6: Wire `jsonWithCache` into `app/api/dwh/clientes/route.ts`**

Read the file first to find its exact current return sites (`return NextResponse.json(response);` and any breakdown early-return). Add `jsonWithCache` to the existing `query-builder` import line, then replace every **success** `NextResponse.json(...)` call (never the `catch` block's error response) with `jsonWithCache(...)`, same arguments. Example for the common final-response shape:

```typescript
// before
return NextResponse.json(response);
// after
return jsonWithCache(response);
```

Leave `return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });` in the `catch` block completely unchanged.

- [ ] **Step 7: Repeat Step 6 for the remaining 10 route files**

Apply the identical mechanical change (import `jsonWithCache`, swap every non-error `NextResponse.json(...)` call for `jsonWithCache(...)`, leave the `catch` block's 500 response untouched) to:
`app/api/dwh/compras/route.ts`, `app/api/dwh/cxc/route.ts`, `app/api/dwh/dashboard/route.ts`, `app/api/dwh/devoluciones/route.ts`, `app/api/dwh/finanzas/route.ts`, `app/api/dwh/multimoneda/route.ts`, `app/api/dwh/productos/route.ts`, `app/api/dwh/resumen/route.ts`, `app/api/dwh/vendedores/route.ts`, `app/api/dwh/ventas/route.ts`.

Note `productos/route.ts` and `vendedores/route.ts` each have an extra early-return breakdown branch (`return NextResponse.json({ ... });` before the final response) — both must be converted, not just the last one in the file.

- [ ] **Step 8: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 9: Add a regression test asserting the header on one representative route**

In `app/api/dwh/finanzas/__tests__/route.test.ts`, add a second test alongside the existing 401 test:

```typescript
import { describe, test, expect } from 'bun:test';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/dwh/finanzas', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://localhost/api/dwh/finanzas?dateRange=12m');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test('the 401 auth-rejection response is never cached', async () => {
    const req = new NextRequest('http://localhost/api/dwh/finanzas?dateRange=12m');
    const res = await GET(req);
    expect(res.headers.get('Cache-Control')).not.toBe('private, max-age=900');
  });
});
```

- [ ] **Step 10: Run the finanzas route test**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts --env-file=.env.local`
Expected: PASS (2/2).

- [ ] **Step 11: Manually verify one route's success response carries the header against the live local DWH**

If a dev server is easy to start in your environment: `bun dev`, then as a logged-in admin, open a new browser tab to `/api/dwh/finanzas?dateRange=12m` directly and check the Network tab's Response Headers for `Cache-Control: private, max-age=900`. If starting a dev server isn't practical, a careful read-through confirming every route's final success return site was converted (grep below) is an acceptable substitute — note which you did.

Run this grep to confirm no success-path `NextResponse.json` calls were missed (matches should be ONLY the 11 routes' `catch`-block error responses, i.e. every match's line should contain `error:` and `status: 500`):

```bash
grep -rn "NextResponse.json(" app/api/dwh/*/route.ts | grep -v "jsonWithCache" | grep -v "^app/api/dwh/lib/"
```

Expected: every line printed contains `{ error: 'Error al consultar el Data Warehouse' }, { status: 500 }` — if any line does NOT match that shape, Step 7 missed a success-path call site; go back and convert it.

- [ ] **Step 12: Commit**

```bash
git add app/api/dwh/clientes/route.ts app/api/dwh/compras/route.ts app/api/dwh/cxc/route.ts app/api/dwh/dashboard/route.ts app/api/dwh/devoluciones/route.ts app/api/dwh/finanzas/route.ts app/api/dwh/multimoneda/route.ts app/api/dwh/productos/route.ts app/api/dwh/resumen/route.ts app/api/dwh/vendedores/route.ts app/api/dwh/ventas/route.ts app/api/dwh/finanzas/__tests__/route.test.ts
git commit -m "feat: add Cache-Control: private, max-age=900 to every DWH API route"
```

---

## Task 2: Flatten `tab-ventas.tsx` — stacked mes/cliente/línea sections

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-ventas.tsx`
- No route change needed — `app/api/dwh/ventas/route.ts` already accepts `groupBy=mes|cliente|linea` independently; this task just calls it three times instead of once.

**Interfaces:**
- Consumes: `GET /api/dwh/ventas?dateRange=X&currency=Y&groupBy=mes|cliente|linea[&clienteDimension=...][&month=...]` (unchanged route contract), `VentasResponse` (unchanged type), `GroupedDrilldownTable` (unchanged component).
- Produces: no new exports — this is a self-contained component rewrite. `TabVentas`'s own prop signature (`{ dateRange, currency }`) is unchanged, so `analitica-client.tsx` needs no edit.

- [ ] **Step 1: Read the current file once more to confirm line ranges before editing**

Re-read `app/(app)/analitica/tabs/tab-ventas.tsx` in full immediately before this task's edit (already read in full during planning — reconfirm nothing changed if another task landed first).

- [ ] **Step 2: Replace the single-`groupBy` state with three independent per-section fetch states**

Replace the whole component body (everything from `export default function TabVentas` through its closing brace) with:

```tsx
export default function TabVentas({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  // Three independently-fetched sections, always rendered together (Part 1
  // of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md
  // — no more groupBy toggle hiding two of the three). Each section keeps
  // its own loading/error/data state so one slow query doesn't block the
  // others from rendering.
  const [mesData, setMesData] = useState<VentasResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  const [month, setMonth] = useState<string | null>(null);
  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [clienteData, setClienteData] = useState<VentasResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  const [lineaData, setLineaData] = useState<VentasResponse | null>(null);
  const [lineaLoading, setLineaLoading] = useState<boolean>(true);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMesError(null);
      setMesLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'mes' });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMesError(body.error ?? 'Error desconocido');
          return;
        }
        setMesData(await res.json());
      } catch {
        if (!cancelled) setMesError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setMesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'cliente', clienteDimension });
        if (month) params.set('month', month);
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setClienteError(body.error ?? 'Error desconocido');
          return;
        }
        setClienteData(await res.json());
      } catch {
        if (!cancelled) setClienteError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setClienteLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, clienteDimension, month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea' });
        const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLineaError(body.error ?? 'Error desconocido');
          return;
        }
        setLineaData(await res.json());
      } catch {
        if (!cancelled) setLineaError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLineaLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  // Clicking a month bar no longer swaps which section is visible (there is
  // only one layout now) — it just scopes the always-visible cliente
  // section to that month and scrolls it into view.
  function handleBarClick(value: string) {
    setMonth(value);
    document.getElementById('ventas-cliente-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const mesRate = mesData?.usdRate ?? undefined;
  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    salesNet: r.salesNet,
  }));

  const clienteRate = clienteData?.usdRate ?? undefined;
  const clienteTableRows: VentasTableRow[] = useMemo(
    () => (clienteData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [clienteData]
  );

  const lineaRate = lineaData?.usdRate ?? undefined;
  const lineaTableRows: VentasTableRow[] = useMemo(
    () => (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [lineaData]
  );

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'cliente',
      clienteDimension,
      breakdownBy: dimension,
      parentValue,
    });
    if (month) params.set('month', month);
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'linea',
      breakdownBy: dimension,
      parentValue,
    });
    const res = await fetch(`/api/dwh/ventas?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const clienteColumns: DrilldownColumn<VentasTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency, clienteRate),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const lineaColumns: DrilldownColumn<VentasTableRow>[] = [
    {
      key: 'salesNet',
      label: 'Ventas netas',
      align: 'right',
      format: row => moneyLabel(row.salesNet, currency, lineaRate),
    },
    {
      key: 'returnRate',
      label: 'Tasa dev.',
      align: 'right',
      format: row => (row.returnRate !== null ? `${(row.returnRate * 100).toFixed(1)}%` : '—'),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  return (
    <div className="p-6 max-w-7xl space-y-8">
      {/* Por mes */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por mes</h3>
        {mesLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!mesLoading && mesError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{mesError}</p>
        )}
        {!mesLoading && !mesError && (
          <ChartCard title="Tendencia de ventas" subtitle="Ventas netas por mes — clic en una barra para ver clientes de ese mes">
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} margin={{ top: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, mesRate)} />
                  <Tooltip formatter={val => moneyTooltip(val, currency, mesRate)} />
                  <Bar
                    dataKey="salesNet"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => handleBarClick(entry.payload?.value)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </section>

      {/* Por cliente */}
      <section id="ventas-cliente-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por cliente{month ? ` — ${month}` : ''}
        </h3>
        {clienteLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!clienteLoading && clienteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{clienteError}</p>
        )}
        {!clienteLoading && !clienteError && clienteData && (
          <GroupedDrilldownTable<VentasTableRow>
            rows={clienteTableRows}
            columns={clienteColumns}
            groupByOptions={CLIENTE_GROUP_BY_OPTIONS}
            groupBy={clienteDimension}
            onGroupByChange={next => setClienteDimension(next as 'cliente_entidad' | 'cliente_tienda')}
            breakdownByOptions={BREAKDOWN_BY_OPTIONS}
            breakdownBy={breakdownBy}
            onBreakdownByChange={setBreakdownBy}
            onFetchBreakdown={handleFetchBreakdown}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, clienteRate) : String(value ?? '—'))}
          />
        )}
        {month && (
          <button
            onClick={() => setMonth(null)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Quitar filtro de mes
          </button>
        )}
      </section>

      {/* Por línea */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por línea</h3>
        {lineaLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!lineaLoading && lineaError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{lineaError}</p>
        )}
        {!lineaLoading && !lineaError && lineaData && (
          <GroupedDrilldownTable<VentasTableRow>
            rows={lineaTableRows}
            columns={lineaColumns}
            groupByOptions={LINEA_GROUP_BY_OPTIONS}
            groupBy="producto"
            onGroupByChange={() => {}}
            breakdownByOptions={LINEA_BREAKDOWN_BY_OPTIONS}
            breakdownBy={lineaBreakdownBy}
            onBreakdownByChange={setLineaBreakdownBy}
            onFetchBreakdown={handleFetchLineaBreakdown}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, lineaRate) : String(value ?? '—'))}
          />
        )}
      </section>
    </div>
  );
}
```

Leave the file's top (imports, `ChartCard`, `EmptyState`, `CLIENTE_GROUP_BY_OPTIONS`, `BREAKDOWN_BY_OPTIONS`, `LINEA_GROUP_BY_OPTIONS`, `LINEA_BREAKDOWN_BY_OPTIONS`, `VentasTableRow` interface) as-is, **except** delete the now-unused `GROUP_BY_OPTIONS` constant (original lines 30-34) — it was only referenced by the removed button row. Do not remove `CLIENTE_GROUP_BY_OPTIONS`/`BREAKDOWN_BY_OPTIONS`/`LINEA_GROUP_BY_OPTIONS`/`LINEA_BREAKDOWN_BY_OPTIONS` — all four are still used above. Remove the unused `GroupBy` import from the type-import line at the top (`PivotDimension`, `VentasResponse`, `VentasRow` stay; `GroupBy` is no longer referenced anywhere in this file once `GROUP_BY_OPTIONS`/`groupBy` state are gone).

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors from this file (confirms the unused-import removal was complete and no leftover reference to the deleted `groupBy`/`setGroupBy`/`handleGroupByChange`/`handleBreadcrumbClick`/`subtitleByGroupBy` symbols remains).

- [ ] **Step 4: Manually verify in a browser, or read-through if a dev server isn't practical**

If practical: `bun dev`, navigate to `/analitica?tab=ventas` as an admin. Confirm: three sections render simultaneously without clicking anything ("Por mes" chart, "Por cliente" table, "Por línea" table), clicking a month bar scrolls to and filters the "Por cliente" section (heading shows the month, a "Quitar filtro de mes" link appears), the Entidad/Tienda select and both breakdown selects still work independently per section. If a dev server isn't practical, a careful JSX read-through plus the passing type-check is an acceptable substitute — note which you did.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-ventas.tsx"
git commit -m "refactor: flatten Ventas tab's mes/cliente/línea view-selector into stacked sections"
```

---

## Task 3: Flatten `tab-compras.tsx` — stacked mes/proveedor/línea sections

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-compras.tsx`
- No route change needed — `app/api/dwh/compras/route.ts` already accepts `groupBy=mes|proveedor|linea` independently.

**Interfaces:**
- Consumes: `GET /api/dwh/compras?dateRange=X&currency=Y&groupBy=mes|proveedor|linea[&month=...]` (unchanged route contract), `ComprasResponse` (unchanged type).
- Produces: no new exports — `TabCompras`'s prop signature (`{ dateRange, currency }`) is unchanged.

- [ ] **Step 1: Re-read the current file to confirm nothing shifted since planning**

Re-read `app/(app)/analitica/tabs/tab-compras.tsx` in full before editing.

- [ ] **Step 2: Replace the single-`groupBy` state with three independent per-section fetch states**

Replace the whole component body (everything from `export default function TabCompras` through its closing brace) with:

```tsx
export default function TabCompras({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [mesData, setMesData] = useState<ComprasResponse | null>(null);
  const [mesLoading, setMesLoading] = useState<boolean>(true);
  const [mesError, setMesError] = useState<string | null>(null);

  const [month, setMonth] = useState<string | null>(null);
  const [proveedorData, setProveedorData] = useState<ComprasResponse | null>(null);
  const [proveedorLoading, setProveedorLoading] = useState<boolean>(true);
  const [proveedorError, setProveedorError] = useState<string | null>(null);

  const [lineaData, setLineaData] = useState<ComprasResponse | null>(null);
  const [lineaLoading, setLineaLoading] = useState<boolean>(true);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMesError(null);
      setMesLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'mes' });
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMesError(body.error ?? 'Error desconocido');
          return;
        }
        setMesData(await res.json());
      } catch {
        if (!cancelled) setMesError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setMesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProveedorError(null);
      setProveedorLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'proveedor' });
        if (month) params.set('month', month);
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setProveedorError(body.error ?? 'Error desconocido');
          return;
        }
        setProveedorData(await res.json());
      } catch {
        if (!cancelled) setProveedorError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setProveedorLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, month]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLineaError(null);
      setLineaLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea' });
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLineaError(body.error ?? 'Error desconocido');
          return;
        }
        setLineaData(await res.json());
      } catch {
        if (!cancelled) setLineaError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLineaLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  function handleBarClick(value: string) {
    setMonth(value);
    document.getElementById('compras-proveedor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const mesRate = mesData?.usdRate ?? undefined;
  const chartData = (mesData?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    purchasesNet: r.purchasesNet,
  }));

  const proveedorRate = proveedorData?.usdRate ?? undefined;
  const proveedorTableRows: ComprasTableRow[] = useMemo(
    () => (proveedorData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [proveedorData]
  );

  const lineaRate = lineaData?.usdRate ?? undefined;
  const lineaTableRows: ComprasTableRow[] = useMemo(
    () => (lineaData?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [lineaData]
  );

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea', breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/compras?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const proveedorColumns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, proveedorRate),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const lineaColumns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, lineaRate),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  return (
    <div className="p-6 max-w-7xl space-y-8">
      {/* Por mes */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por mes</h3>
        {mesLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!mesLoading && mesError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{mesError}</p>
        )}
        {!mesLoading && !mesError && (
          <ChartCard title="Tendencia de compras" subtitle="Compras netas por mes — clic en una barra para ver proveedores de ese mes">
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} margin={{ top: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, mesRate)} />
                  <Tooltip formatter={val => moneyTooltip(val, currency, mesRate)} />
                  <Bar
                    dataKey="purchasesNet"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => handleBarClick(entry.payload?.value)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </section>

      {/* Por proveedor */}
      <section id="compras-proveedor-section">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Por proveedor{month ? ` — ${month}` : ''}
        </h3>
        {proveedorLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!proveedorLoading && proveedorError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{proveedorError}</p>
        )}
        {!proveedorLoading && !proveedorError && proveedorData && (
          <GroupedDrilldownTable<ComprasTableRow>
            rows={proveedorTableRows}
            columns={proveedorColumns}
            groupByOptions={PROVEEDOR_GROUP_BY_OPTIONS}
            groupBy="proveedor"
            onGroupByChange={() => {}}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, proveedorRate) : String(value ?? '—'))}
          />
        )}
        {month && (
          <button onClick={() => setMonth(null)} className="mt-2 text-xs text-blue-600 hover:underline">
            Quitar filtro de mes
          </button>
        )}
      </section>

      {/* Por línea */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por línea</h3>
        {lineaLoading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}
        {!lineaLoading && lineaError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{lineaError}</p>
        )}
        {!lineaLoading && !lineaError && lineaData && (
          <GroupedDrilldownTable<ComprasTableRow>
            rows={lineaTableRows}
            columns={lineaColumns}
            groupByOptions={LINEA_GROUP_BY_OPTIONS}
            groupBy="producto"
            onGroupByChange={() => {}}
            breakdownByOptions={LINEA_BREAKDOWN_BY_OPTIONS}
            breakdownBy={lineaBreakdownBy}
            onBreakdownByChange={setLineaBreakdownBy}
            onFetchBreakdown={handleFetchLineaBreakdown}
            formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, lineaRate) : String(value ?? '—'))}
          />
        )}
      </section>
    </div>
  );
}
```

Delete the now-unused `GROUP_BY_OPTIONS` constant (original lines 30-34) and the `GroupBy` import from the type-import line (no longer referenced once `groupBy` state/`GROUP_BY_OPTIONS` are gone) — keep `PROVEEDOR_GROUP_BY_OPTIONS`, `LINEA_GROUP_BY_OPTIONS`, `LINEA_BREAKDOWN_BY_OPTIONS`, `ComprasTableRow`, `ChartCard`, `EmptyState` as-is.

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors from this file.

- [ ] **Step 4: Manually verify in a browser, or read-through if a dev server isn't practical**

If practical: `bun dev`, navigate to `/analitica?tab=compras`. Confirm all three sections render at once, clicking a month bar filters+scrolls to "Por proveedor", "Por línea"'s producto breakdown still expands. If not practical, a JSX read-through plus the passing type-check substitutes — note which you did.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-compras.tsx"
git commit -m "refactor: flatten Compras tab's mes/proveedor/línea view-selector into stacked sections"
```

---

## Task 4: Flatten `tab-devoluciones.tsx` — stacked salesrep/producto/cliente sections

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-devoluciones.tsx`
- No route change needed — `app/api/dwh/devoluciones/route.ts` already accepts `groupBy=salesrep|producto|cliente` independently.

**Interfaces:**
- Consumes: `GET /api/dwh/devoluciones?dateRange=X&currency=Y&groupBy=salesrep|producto|cliente[&clienteDimension=...]` (unchanged route contract), `DevolucionesResponse`/`DevolucionesMatrixCell` (unchanged types).
- Produces: no new exports — `TabDevoluciones`'s prop signature (`{ dateRange, currency }`) is unchanged.

- [ ] **Step 1: Re-read the current file to confirm nothing shifted since planning**

Re-read `app/(app)/analitica/tabs/tab-devoluciones.tsx` in full before editing.

- [ ] **Step 2: Replace the single-`groupBy` state with three independent per-section fetch states**

Replace the whole component body (everything from `export default function TabDevoluciones` through its closing brace) with:

```tsx
export default function TabDevoluciones({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [salesrepData, setSalesrepData] = useState<DevolucionesResponse | null>(null);
  const [salesrepLoading, setSalesrepLoading] = useState<boolean>(true);
  const [salesrepError, setSalesrepError] = useState<string | null>(null);

  const [productoData, setProductoData] = useState<DevolucionesResponse | null>(null);
  const [productoLoading, setProductoLoading] = useState<boolean>(true);
  const [productoError, setProductoError] = useState<string | null>(null);

  const [clienteDimension, setClienteDimension] = useState<'cliente_entidad' | 'cliente_tienda'>('cliente_entidad');
  const [clienteData, setClienteData] = useState<DevolucionesResponse | null>(null);
  const [clienteLoading, setClienteLoading] = useState<boolean>(true);
  const [clienteError, setClienteError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSalesrepError(null);
      setSalesrepLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'salesrep' });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSalesrepError(body.error ?? 'Error desconocido');
          return;
        }
        setSalesrepData(await res.json());
      } catch {
        if (!cancelled) setSalesrepError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setSalesrepLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProductoError(null);
      setProductoLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'producto' });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setProductoError(body.error ?? 'Error desconocido');
          return;
        }
        setProductoData(await res.json());
      } catch {
        if (!cancelled) setProductoError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setProductoLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setClienteError(null);
      setClienteLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy: 'cliente', clienteDimension });
        const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setClienteError(body.error ?? 'Error desconocido');
          return;
        }
        setClienteData(await res.json());
      } catch {
        if (!cancelled) setClienteError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setClienteLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, clienteDimension]);

  const salesrepRate = salesrepData?.usdRate ?? undefined;
  const productoRate = productoData?.usdRate ?? undefined;
  const clienteRate = clienteData?.usdRate ?? undefined;

  const clienteRows: DevolucionesTableRow[] = useMemo(() => {
    if (!clienteData) return [];
    return clienteData.rows
      .filter(r => r.clienteValue !== null)
      .map(r => ({
        label: r.cliente,
        value: r.clienteValue as string,
        ratioDevolucion: r.ratioDevolucion,
        amountNet: r.amountNet,
      }));
  }, [clienteData]);

  async function handleFetchBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({
      dateRange,
      currency,
      groupBy: 'cliente',
      clienteDimension,
      breakdownBy: dimension,
      parentValue,
    });
    const res = await fetch(`/api/dwh/devoluciones?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const clienteColumns: DrilldownColumn<DevolucionesTableRow>[] = [
    {
      key: 'amountNet',
      label: 'Monto neto',
      align: 'right',
      format: row => moneyLabel(row.amountNet, currency, clienteRate),
    },
    {
      key: 'ratioDevolucion',
      label: 'Tasa dev.',
      align: 'right',
      format: row => pct(row.ratioDevolucion),
    },
  ];

  function MatrixTable({
    rows,
    rate,
    nameColumnLabel,
    nameOf,
  }: {
    rows: DevolucionesMatrixCell[];
    rate: number | undefined;
    nameColumnLabel: string;
    nameOf: (row: DevolucionesMatrixCell) => string;
  }) {
    if (rows.length === 0) return <EmptyState />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{nameColumnLabel}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tasa dev.</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Monto neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={`${nameOf(row)}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                <td className="px-3 py-2 text-gray-800">{nameOf(row)}</td>
                <td
                  className={`px-3 py-2 text-right ${
                    row.ratioDevolucion !== null && row.ratioDevolucion > 0.05 ? 'text-orange-600 font-medium' : 'text-gray-600'
                  }`}
                >
                  {pct(row.ratioDevolucion)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{moneyLabel(row.amountNet, currency, rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Devoluciones</h2>
        <p className="text-sm text-gray-500">Matriz de devoluciones y tasa de devolución (devoluciones / ventas)</p>
      </div>

      {/* Por vendedor */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por vendedor</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {salesrepLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : salesrepError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{salesrepError}</p>
          ) : (
            <MatrixTable rows={salesrepData?.rows ?? []} rate={salesrepRate} nameColumnLabel="Vendedor" nameOf={row => row.salesRep} />
          )}
        </div>
      </section>

      {/* Por producto */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por producto</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {productoLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : productoError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{productoError}</p>
          ) : (
            <MatrixTable rows={productoData?.rows ?? []} rate={productoRate} nameColumnLabel="Producto" nameOf={row => row.producto} />
          )}
        </div>
      </section>

      {/* Por cliente */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Por cliente</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {clienteLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-500">Cargando…</div>
          ) : clienteError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{clienteError}</p>
          ) : clienteRows.length === 0 ? (
            <EmptyState />
          ) : (
            <GroupedDrilldownTable<DevolucionesTableRow>
              rows={clienteRows}
              columns={clienteColumns}
              groupByOptions={CLIENTE_GROUP_BY_OPTIONS}
              groupBy={clienteDimension}
              onGroupByChange={next => setClienteDimension(next as 'cliente_entidad' | 'cliente_tienda')}
              breakdownByOptions={BREAKDOWN_BY_OPTIONS}
              breakdownBy={breakdownBy}
              onBreakdownByChange={setBreakdownBy}
              onFetchBreakdown={handleFetchBreakdown}
              formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, clienteRate) : String(value ?? '—'))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
```

Delete the now-unused `GROUP_OPTIONS` constant (original lines 10-14) and its only other reference, the `groupLabel` helper (original lines 97-98) — both were only used by the removed toggle/breadcrumb. Keep `CLIENTE_GROUP_BY_OPTIONS`, `BREAKDOWN_BY_OPTIONS`, `DevolucionesTableRow`, `pct`, `EmptyState` as-is. Add a new import for `DevolucionesMatrixCell` from `../types` (needed by the new `MatrixTable` helper's prop type) alongside the existing type imports.

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors from this file.

- [ ] **Step 4: Manually verify in a browser, or read-through if a dev server isn't practical**

If practical: `bun dev`, navigate to `/analitica?tab=devoluciones`. Confirm all three sections (Por vendedor, Por producto, Por cliente) render at once without clicking anything, and the cliente section's Entidad/Tienda select and breakdown select still work. If not practical, a JSX read-through plus the passing type-check substitutes — note which you did.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-devoluciones.tsx"
git commit -m "refactor: flatten Devoluciones tab's salesrep/producto/cliente view-selector into stacked sections"
```

---

## Task 5: Rewrite existing E2E tests broken by Part 1's flattening + add flattening coverage

**Files:**
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: the rendered, flattened Ventas/Compras/Devoluciones tabs from Tasks 2-4.

Three existing tests assume the removed toggle-button UI (`'Por cliente'`, `'Por Cliente'`, `'Por proveedor'`, `'Por línea'` as clickable buttons that swap sections) — they now fail because those buttons don't exist. This task rewrites them to assert the flattened, always-visible layout instead of deleting coverage.

- [ ] **Step 1: Run the full e2e suite once to confirm which tests currently fail after Tasks 2-4**

Run (Node 20+ if your default is older — `nvm use 20` first if needed): `bunx playwright test e2e/analitica.spec.ts -g "@mssql"`
Expected: at minimum, `'toggling Entidad/Tienda changes the Ventas top-clientes list'`, `'a multi-store chain appears as a single row in Devoluciones entity mode'`, and `'Compras tab shows the monthly trend, drills into proveedores, and expands a línea breakdown'` FAIL (their target buttons no longer render). Confirm this matches, then proceed to rewrite them.

- [ ] **Step 2: Rewrite `'toggling Entidad/Tienda changes the Ventas top-clientes list'`**

Find this test (originally lines 30-53) and replace it entirely:

```typescript
  test('Ventas tab renders all three sections at once and Entidad/Tienda toggles the cliente section', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=ventas');

    // Part 1 flattening: all three sections render immediately, no toggle
    // click required. Assert all three section headings are visible
    // simultaneously (not one-at-a-time behind a button).
    await expect(adminPage.getByRole('heading', { name: 'Por mes' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por cliente' })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Por línea' })).toBeVisible();

    // The cliente section's own "Agrupar por" <select> (GroupedDrilldownTable)
    // still toggles Entidad/Tienda grain, same underlying mechanism as before
    // flattening — just no longer gated behind a separate view-selector click.
    const groupBySelect = adminPage.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('cliente_entidad');
    await expect(adminPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
    const entidadRowCount = await adminPage.locator('table tbody tr').count();

    await groupBySelect.selectOption('cliente_tienda');
    await expect(adminPage.locator('table tbody tr')).not.toHaveCount(0);
    const tiendaRowCount = await adminPage.locator('table tbody tr').count();
    expect(tiendaRowCount).toBeGreaterThanOrEqual(entidadRowCount);
  });
```

- [ ] **Step 3: Rewrite `'a multi-store chain appears as a single row in Devoluciones entity mode'`**

Find this test (originally lines 55-66) and replace it entirely:

```typescript
  test('Devoluciones tab renders all three sections at once and the cliente section supports Entidad grain', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=devoluciones');

    // Part 1 flattening: no "Por Cliente" button to click — all three
    // sections (vendedor/producto/cliente) render immediately.
    await expect(adminPage.getByRole('heading', { name: 'Por vendedor' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por producto' })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Por cliente' })).toBeVisible();

    // The cliente section defaults to Entidad grain already (same default as
    // before flattening) — assert the table renders without error and has
    // at least one row, same structural check as the original test (exact
    // chain names depend on whatever ERP test data is loaded).
    const clienteSection = adminPage.locator('section', { has: adminPage.getByRole('heading', { name: 'Por cliente' }) });
    await expect(clienteSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });
```

- [ ] **Step 4: Rewrite `'Compras tab shows the monthly trend, drills into proveedores, and expands a línea breakdown'`**

Find this test (originally the last test in the file) and replace it entirely:

```typescript
  test('Compras tab renders all three sections at once, month-click filters proveedores, and a línea breakdown expands', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=compras');

    // Part 1 flattening: all three sections render immediately.
    await expect(adminPage.getByRole('heading', { name: 'Por mes' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Por proveedor' })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: 'Por línea' })).toBeVisible();

    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible({ timeout: 15_000 });

    // Same two recharts+Playwright quirks as the original test: the entrance
    // animation grows each bar from 0 height over ~1.5s, and some months in
    // the seeded data have near-zero totals — wait past the animation and
    // click the last (most recent, most likely non-trivial) bar.
    const bars = chart.locator('.recharts-bar-rectangle path');
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    await adminPage.waitForTimeout(1_500);
    await bars.last().click({ force: true });

    // Clicking a month bar no longer swaps sections (there's only one
    // layout) — it scopes+scrolls to the always-visible "Por proveedor"
    // section, whose heading now shows the selected month.
    const proveedorSection = adminPage.locator('section#compras-proveedor-section');
    await expect(proveedorSection.getByRole('heading')).toContainText('Por proveedor —');
    await expect(proveedorSection.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 });

    const groupBySelect = adminPage.getByLabel('Agrupar por:');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('proveedor');

    // "Por línea" section — expand the first row's producto breakdown.
    const lineaSection = adminPage.locator('section', { has: adminPage.getByRole('heading', { name: 'Por línea' }) });
    const outerRows = lineaSection.locator('table.min-w-full.text-sm > tbody > tr');
    await expect(outerRows.first()).toBeVisible({ timeout: 15_000 });

    await lineaSection.getByLabel('Desglosar por:').selectOption('producto');
    const firstOuterRow = outerRows.first();
    const expandButton = firstOuterRow.locator('button[aria-label="Expandir"]');
    await expect(expandButton).toBeVisible();

    const parentMoneyCell = firstOuterRow.locator('td').nth(-2);
    const parentAmountBs = await parentMoneyCell.textContent();

    await expandButton.click();

    const breakdownRows = firstOuterRow.locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    await expect(breakdownRows.first()).toBeVisible({ timeout: 15_000 });

    const productoAmountBs = await breakdownRows.first().locator('td').last().textContent();

    await adminPage.getByRole('button', { name: 'USD' }).click();

    await expect(parentMoneyCell).not.toHaveText(parentAmountBs ?? '');
    await expect(parentMoneyCell).toContainText('$');

    // Toggling currency remounts each section's GroupedDrilldownTable while
    // its own fetch is in flight (same effect-dependency-on-currency pattern
    // as every other tab), collapsing the expanded row — re-expand before
    // reading its fresh money cell.
    const expandButtonAfterToggle = outerRows.first().locator('button[aria-label="Expandir"]');
    await expect(expandButtonAfterToggle).toBeVisible({ timeout: 15_000 });
    await expandButtonAfterToggle.click();

    const breakdownRowsAfterToggle = outerRows.first().locator('xpath=following-sibling::tr[1]').locator('table tbody tr');
    const productoMoneyCellAfterToggle = breakdownRowsAfterToggle.first().locator('td').last();
    await expect(productoMoneyCellAfterToggle).toBeVisible({ timeout: 15_000 });

    await expect(productoMoneyCellAfterToggle).not.toHaveText(productoAmountBs ?? '');
    await expect(productoMoneyCellAfterToggle).toContainText('$');
  });
```

- [ ] **Step 5: Run the three rewritten tests**

Run: `bunx playwright test e2e/analitica.spec.ts -g "renders all three sections"`
Expected: all 3 PASS.

- [ ] **Step 6: Run the full file to confirm no other regressions from Tasks 2-4**

Run: `bunx playwright test e2e/analitica.spec.ts -g "@mssql"`
Expected: PASS (every test in the file, including ones untouched by this task — `'expanding a Vendedores row...'`, the Finanzas tests, the date-range picker test).

- [ ] **Step 7: Commit**

```bash
git add e2e/analitica.spec.ts
git commit -m "test: update Ventas/Devoluciones/Compras E2E coverage for flattened stacked sections"
```

---

## Task 6: Finanzas route — Utilidad Bruta (proxy) + Margen Operativo % waterfall restructure

**Files:**
- Create: `app/api/dwh/finanzas/margen-proxy.ts`
- Modify: `app/api/dwh/finanzas/route.ts`
- Modify: `app/(app)/analitica/types.ts`
- Test: `app/api/dwh/finanzas/__tests__/margen-proxy.test.ts` (new)

**Interfaces:**
- Consumes: `dwh.vw_GastosOperativos` (already exists, `dwh-migrations/0026_gastos_operativos_view.sql`) — no new SQL object needed, per the spec. The route's existing `expenseCategoryQuery`/`categoryResult` already returns one row per `Category` including `'Compras'`.
- Produces: `FinanzasResponse` gains a new `margenProxy` field alongside the unchanged `waterfall`/`cashFlowEbitda`/`expenseBreakdown`/`usdRate` fields. `cashFlowEbitda`'s 6 existing fields are unchanged in name and meaning — Task 13 (Part 4 cleanup) removes the old `waterfall` field entirely once Task 7 (tab) no longer reads it, so this task's response carries BOTH the old `waterfall` and the new `margenProxy` side by side. `computeMargenProxy` is exported from a new standalone file (`margen-proxy.ts`), NOT from `route.ts` — Next.js App Router route handler files may only export whitelisted names (`GET`/`POST`/`dynamic`/etc.), so a pure-computation helper needing its own unit test must live outside `route.ts`.

- [ ] **Step 1: Add the new type to `types.ts`**

In `app/(app)/analitica/types.ts`, find the `FinanzasResponse`/`CashFlowEbitda` block (original lines 182-208) and add a new interface directly after `ExpenseCategoryRow`:

```typescript
export interface ExpenseCategoryRow {
  category: string;
  amount: number;
}

// Proxy gross-margin waterfall (Part 2 of docs/superpowers/specs/
// 2026-09-15-analitica-ui-and-margin-design.md): Compras stands in for COGS
// since Fact_Sales has never recorded real product cost (see
// docs/DATA_WAREHOUSE_GUIDE.md's Cost Data Gap section) — this is
// deliberately a proxy, not exact COGS-based gross margin, and distinct
// from Margen Operativo (which nets against ALL operating expenses, not
// just Compras).
export interface MargenProxy {
  ingresos: number;
  compras: number;
  utilidadBruta: number; // ingresos - compras
  margenBrutoRate: number | null; // utilidadBruta / ingresos
  otrosGastosOperativos: number; // gastosOperativos - compras
  margenOperativo: number; // utilidadBruta - otrosGastosOperativos (equals cashFlowEbitda.ebitda)
  margenOperativoRate: number | null; // margenOperativo / ingresos
}
```

Then add the field to `FinanzasResponse` (leave `waterfall`, `cashFlowEbitda`, `expenseBreakdown`, `usdRate` exactly as they are — this is an addition, not a replacement, in this task):

```typescript
export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  cashFlowEbitda: CashFlowEbitda;
  margenProxy: MargenProxy;
  expenseBreakdown: ExpenseCategoryRow[];
  usdRate: number | null;
}
```

- [ ] **Step 2: Write the failing unit test for `computeMargenProxy`**

Create `app/api/dwh/finanzas/__tests__/margen-proxy.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { computeMargenProxy } from '../margen-proxy';

describe('computeMargenProxy', () => {
  test('computes Utilidad Bruta and Margen Operativo from ingresos/compras/gastosOperativos', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 400, gastosOperativos: 600 });
    expect(result.ingresos).toBe(1000);
    expect(result.compras).toBe(400);
    expect(result.utilidadBruta).toBe(600); // 1000 - 400
    expect(result.margenBrutoRate).toBeCloseTo(0.6, 5); // 600 / 1000
    expect(result.otrosGastosOperativos).toBe(200); // 600 - 400
    expect(result.margenOperativo).toBe(400); // 600 - 200
    expect(result.margenOperativoRate).toBeCloseTo(0.4, 5); // 400 / 1000
  });

  test('margenOperativo equals ingresos - gastosOperativos (matches the existing ebitda calc)', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 400, gastosOperativos: 600 });
    expect(result.margenOperativo).toBe(1000 - 600);
  });

  test('rates are null when ingresos is 0 (avoids division by zero)', () => {
    const result = computeMargenProxy({ ingresos: 0, compras: 0, gastosOperativos: 0 });
    expect(result.margenBrutoRate).toBeNull();
    expect(result.margenOperativoRate).toBeNull();
  });

  test('handles compras greater than gastosOperativos (otrosGastosOperativos can go negative, e.g. a refund-heavy period)', () => {
    const result = computeMargenProxy({ ingresos: 1000, compras: 700, gastosOperativos: 600 });
    expect(result.otrosGastosOperativos).toBe(-100);
    expect(result.margenOperativo).toBe(1000 - 600);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test app/api/dwh/finanzas/__tests__/margen-proxy.test.ts`
Expected: FAIL — `../margen-proxy` doesn't exist yet.

- [ ] **Step 4: Create `margen-proxy.ts` and implement `computeMargenProxy`**

Create `app/api/dwh/finanzas/margen-proxy.ts`:

```typescript
import type { MargenProxy } from '@/app/(app)/analitica/types';

// Part 2 of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md:
// Compras is used as a proxy for COGS (Fact_Sales has never recorded real
// product cost — see docs/DATA_WAREHOUSE_GUIDE.md's Cost Data Gap section),
// distinct from Margen Operativo (which nets against ALL of
// dwh.vw_GastosOperativos, not just the Compras category within it). Kept in
// its own file (not exported from route.ts) so it's unit-testable without
// touching a Next.js route handler file's export whitelist (route.ts may
// only export GET/POST/etc. and a few reserved names like `dynamic`).
export function computeMargenProxy(input: {
  ingresos: number;
  compras: number;
  gastosOperativos: number;
}): MargenProxy {
  const { ingresos, compras, gastosOperativos } = input;
  const utilidadBruta = ingresos - compras;
  const otrosGastosOperativos = gastosOperativos - compras;
  const margenOperativo = ingresos - gastosOperativos;
  return {
    ingresos,
    compras,
    utilidadBruta,
    margenBrutoRate: ingresos > 0 ? utilidadBruta / ingresos : null,
    otrosGastosOperativos,
    margenOperativo,
    margenOperativoRate: ingresos > 0 ? margenOperativo / ingresos : null,
  };
}
```

- [ ] **Step 5: Wire `computeMargenProxy` into the route's response**

In `app/api/dwh/finanzas/route.ts`, add this import alongside the existing ones near the top of the file:

```typescript
import { computeMargenProxy } from './margen-proxy';
```

Add `MargenProxy` to the existing type-only import line:

```typescript
import type { FinanzasResponse, FinanzasWaterfallStep, ExpenseCategoryRow, MargenProxy } from '@/app/(app)/analitica/types';
```

In `export async function GET`, find where `expenseBreakdown`/`gastosOperativos`/`ingresosOperativos` are computed (directly before the `const response: FinanzasResponse = {` block) and add, immediately after the existing `const ebitda = ingresosOperativos - gastosOperativos;` line:

```typescript
    // comprasAmount pulled from the same expenseBreakdown array already
    // computed above (one row per dwh.vw_GastosOperativos Category,
    // 'Compras' among them) — no extra query needed, matching the spec's
    // "No new SQL view needed" note.
    const comprasAmount = expenseBreakdown.find(r => r.category === 'Compras')?.amount ?? 0;
    const margenProxy = computeMargenProxy({ ingresos: ingresosOperativos, compras: comprasAmount, gastosOperativos });
```

Then add `margenProxy` to the `response` object literal (leave every existing field as-is):

```typescript
    const response: FinanzasResponse = {
      waterfall,
      cashFlowEbitda: {
        ingresosOperativos,
        gastosOperativos,
        ebitda,
        intereses,
        impuestos,
        utilidadNeta,
      },
      margenProxy,
      expenseBreakdown,
      usdRate,
    };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test app/api/dwh/finanzas/__tests__/margen-proxy.test.ts`
Expected: PASS (4/4).

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 8: Run the existing finanzas route tests to confirm no regression**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts --env-file=.env.local`
Expected: PASS (2/2 — the 401 test and Task 1's no-cache-on-401 test).

- [ ] **Step 9: Manually verify against the live local DWH**

If practical: `bun dev`, then as a logged-in admin fetch `/api/dwh/finanzas?dateRange=12m` directly and confirm the JSON response includes a `margenProxy` object whose `margenOperativo` value exactly equals `cashFlowEbitda.ebitda` (same number, per the spec's "unchanged in value from today's `cashFlowEbitda.ebitda`" requirement) and whose `compras` value is a plausible positive number roughly matching the `expenseBreakdown` array's `Compras` row. If a dev server isn't practical, a careful read-through of Step 5's wiring is an acceptable substitute — note which you did.

- [ ] **Step 10: Commit**

```bash
git add app/api/dwh/finanzas/route.ts app/api/dwh/finanzas/margen-proxy.ts "app/(app)/analitica/types.ts" app/api/dwh/finanzas/__tests__/margen-proxy.test.ts
git commit -m "feat: add Utilidad Bruta (proxy) and Margen Operativo % to Finanzas route"
```

---

## Task 7: Finanzas tab — proxy waterfall chart, % on KPI cards, proxy tooltip note

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-finanzas.tsx`

**Interfaces:**
- Consumes: `FinanzasResponse.margenProxy` (Task 6, new field), `FinanzasResponse.waterfall`/`cashFlowEbitda`/`expenseBreakdown`/`usdRate` (unchanged, still present on the response this task — Task 6 added `margenProxy` alongside, didn't remove `waterfall`).
- Produces: no new exports — `TabFinanzas`'s prop signature is unchanged. This task stops reading `data.waterfall` entirely (the old Bruto/Descuento/Neto/COGS/Utilidad Bruta chart and its KPI row are replaced), which is what makes `waterfall`/`FinanzasWaterfallStep`/`toWaterfallData`/`COST_STEPS`/`WaterfallDatum`/`WaterfallTooltip` truly dead code — removed by this task directly (the spec frames this removal as part of Part 2's restructure, not a separate deferred cleanup).

- [ ] **Step 1: Replace the KPI row and waterfall chart section**

In `app/(app)/analitica/tabs/tab-finanzas.tsx`, find the block from the `bruto`/`descuento`/`neto`/`utilidad`/`discountRate`/`marginRate` derivations (original lines 208-214) through the closing `</ChartCard>` of "Cascada de rentabilidad" (original lines 267-292) and replace the whole span with:

```tsx
  const margenProxy = data.margenProxy;

  const proxyWaterfallData: WaterfallDatum[] = [
    { step: 'Ingresos', base: 0, value: margenProxy.ingresos, amount: margenProxy.ingresos, cumulative: margenProxy.ingresos, isNegative: false },
    {
      step: 'Compras',
      base: Math.min(margenProxy.utilidadBruta, margenProxy.ingresos),
      value: margenProxy.compras,
      amount: -margenProxy.compras,
      cumulative: margenProxy.utilidadBruta,
      isNegative: true,
    },
    { step: 'Utilidad Bruta', base: 0, value: margenProxy.utilidadBruta, amount: margenProxy.utilidadBruta, cumulative: margenProxy.utilidadBruta, isNegative: margenProxy.utilidadBruta < 0 },
    {
      step: 'Otros Gastos Operativos',
      base: Math.min(margenProxy.margenOperativo, margenProxy.utilidadBruta),
      value: Math.abs(margenProxy.otrosGastosOperativos),
      amount: -margenProxy.otrosGastosOperativos,
      cumulative: margenProxy.margenOperativo,
      isNegative: margenProxy.otrosGastosOperativos >= 0,
    },
    { step: 'Margen Operativo', base: 0, value: margenProxy.margenOperativo, amount: margenProxy.margenOperativo, cumulative: margenProxy.margenOperativo, isNegative: margenProxy.margenOperativo < 0 },
  ];
```

Then replace the KPI row (original lines 237-246, the `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">...</div>` block containing "Ventas brutas"/"Ventas netas"/"Utilidad bruta"/"Margen bruto") with:

```tsx
      {/* KPI row — Utilidad Bruta (proxy) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ingresos operativos" value={moneyLabel(margenProxy.ingresos, currency, rate)} />
        <KpiCard label="Compras" value={moneyLabel(margenProxy.compras, currency, rate)} />
        <KpiCard label="Utilidad bruta (proxy)" value={moneyLabel(margenProxy.utilidadBruta, currency, rate)} />
        <KpiCard
          label="Margen bruto (proxy)"
          value={pct(margenProxy.margenBrutoRate)}
          tone={margenProxy.margenBrutoRate !== null && margenProxy.margenBrutoRate < 0 ? 'warn' : 'default'}
        />
      </div>

      <p className="text-xs text-gray-500 flex items-center gap-1">
        <span title={PROXY_TOOLTIP} className="cursor-help text-gray-400">ⓘ</span>
        Compras se usa como proxy de costo directo — Profit Plus no registra costo de producto (ver Data Warehouse Guide).
      </p>
```

Then replace the waterfall `<ChartCard>` block (original lines 267-292) with:

```tsx
      <ChartCard
        title="Cascada de rentabilidad (proxy)"
        subtitle={`Ingresos → Compras → Utilidad Bruta → Otros Gastos Operativos → Margen Operativo — margen bruto ${pct(margenProxy.margenBrutoRate)}, margen operativo ${pct(margenProxy.margenOperativoRate)}`}
      >
        {margenProxy.ingresos === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={proxyWaterfallData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="step" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(Number(v), currency, rate)} />
              <Tooltip content={<WaterfallTooltip currency={currency} rate={rate} />} />
              <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="waterfall" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {proxyWaterfallData.map(d => (
                  <Cell key={d.step} fill={d.isNegative ? NEGATIVE_COLOR : POSITIVE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
```

- [ ] **Step 2: Add the `Margen Operativo %` KPI to the existing "Margen Operativo" card section**

In the "Margen Operativo" card block (original lines 248-265, `<div className="bg-white border border-gray-200 rounded-lg p-4">` containing "Ingresos operativos"/"Gastos operativos"/"Margen Operativo"/"Intereses"/"Impuestos"/"Utilidad neta"), find:

```tsx
          <KpiCard label="Margen Operativo" value={moneyLabel(data.cashFlowEbitda.ebitda, currency, rate)} />
```

and add a new KPI card directly after it (leave every other KPI card in this block unchanged):

```tsx
          <KpiCard label="Margen Operativo" value={moneyLabel(data.cashFlowEbitda.ebitda, currency, rate)} />
          <KpiCard
            label="Margen Operativo %"
            value={pct(margenProxy.margenOperativoRate)}
            tone={margenProxy.margenOperativoRate !== null && margenProxy.margenOperativoRate < 0 ? 'warn' : 'default'}
          />
```

- [ ] **Step 3: Add the `PROXY_TOOLTIP` constant and remove the now-dead waterfall helpers**

Add this constant directly after the existing `MARGIN_TOOLTIP` declaration (original line 28):

```tsx
const PROXY_TOOLTIP = 'Utilidad Bruta (proxy) = Ingresos operativos − Compras. Profit Plus no registra costo de producto (Fact_Sales.GrossProfitAmount siempre es NULL), así que Compras se usa como aproximación de costo directo — no es un margen bruto exacto basado en COGS real. Distinto de Margen Operativo, que resta TODOS los gastos operativos, no solo Compras.';
```

Delete the following, now unused because `data.waterfall` is no longer read anywhere in this file: the `COST_STEPS` constant (original line 98), the `toWaterfallData` function (original lines 109-123) — **keep the `WaterfallDatum` interface and `WaterfallTooltip` component themselves** (both are reused by Step 1's new `proxyWaterfallData`/chart). Delete the now-unused `FinanzasWaterfallStep` import from the top-of-file type-import line (still import `FinanzasResponse`, `Currency`, `DateRange`, `PivotDimension`, `BreakdownRow`).

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors — confirms no leftover reference to `toWaterfallData`, `COST_STEPS`, `bruto`, `descuento`, `neto`, `utilidad`, `discountRate`, `marginRate`, or the deleted `FinanzasWaterfallStep` import.

- [ ] **Step 5: Manually verify in a browser, or read-through if a dev server isn't practical**

If practical: `bun dev`, navigate to `/analitica?tab=finanzas`. Confirm: the KPI row now shows "Ingresos operativos / Compras / Utilidad bruta (proxy) / Margen bruto (proxy)" (no more "Ventas brutas"/"Ventas netas"), a tooltip note about the Compras proxy appears below it, the "Margen Operativo" card section gains a "Margen Operativo %" tile, and the waterfall chart shows 5 bars labeled Ingresos/Compras/Utilidad Bruta/Otros Gastos Operativos/Margen Operativo (not the old Bruto/Descuento/Neto/COGS/Utilidad Bruta). If not practical, a JSX read-through plus the passing type-check substitutes — note which you did.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-finanzas.tsx"
git commit -m "feat: replace Finanzas waterfall with Utilidad Bruta (proxy) + Margen Operativo % cascade"
```

---

## Task 8: E2E coverage for the Finanzas proxy waterfall

**Files:**
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: the rendered Finanzas tab from Task 7.

- [ ] **Step 1: Update the stale chart-content assertion in the existing margin-card test**

In `e2e/analitica.spec.ts`, find `'Finanzas tab shows the cash-flow margin card and expense category drilldown'` (originally around line 84). Find this block (originally lines 105-112):

```typescript
    // Sales waterfall chart still renders (Bruto → Descuento → Neto → COGS →
    // Utilidad Bruta only — the margin card's steps are not part of it).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('Utilidad Bruta');
    expect(chartText).not.toContain('EBITDA');
```

Replace it with:

```typescript
    // Proxy gross-margin waterfall renders (Part 2 of docs/superpowers/specs/
    // 2026-09-15-analitica-ui-and-margin-design.md — Ingresos → Compras →
    // Utilidad Bruta → Otros Gastos Operativos → Margen Operativo; the old
    // always-0 Fact_Sales-based Bruto/Descuento/Neto/COGS waterfall is gone).
    const chart = adminPage.getByRole('application');
    await expect(chart).toBeVisible();
    const chartText = await chart.textContent();
    expect(chartText).toContain('Ingresos');
    expect(chartText).toContain('Compras');
    expect(chartText).toContain('Utilidad Bruta');
    expect(chartText).toContain('Otros Gastos Operativos');
    expect(chartText).toContain('Margen Operativo');
    expect(chartText).not.toContain('EBITDA');
    expect(chartText).not.toContain('Descuento');
```

- [ ] **Step 2: Add a new test asserting the KPI cards and proxy tooltip**

Add this test after `'Finanzas tab shows the Nomina cost-center split, including unclassified concepts'`:

```typescript
  test('Finanzas tab shows Utilidad Bruta (proxy) and Margen Operativo % with the proxy tooltip note', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=finanzas&dateRange=custom:2024-01-01:2026-12-31');

    // New KPI cards from the Part 2 restructure.
    await expect(adminPage.getByText('Utilidad bruta (proxy)', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText('Margen bruto (proxy)', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Margen Operativo %', { exact: true })).toBeVisible();

    // Both KPI cards render a "%" value next to their amount, per the
    // spec's "KPI cards show % next to both Utilidad Bruta and Margen
    // Operativo amounts" requirement — assert the cards' own values contain
    // a percent sign (not just presence of the label).
    const margenBrutoCard = adminPage.locator('div', { has: adminPage.getByText('Margen bruto (proxy)', { exact: true }) }).last();
    await expect(margenBrutoCard).toContainText('%');
    const margenOperativoPctCard = adminPage.locator('div', { has: adminPage.getByText('Margen Operativo %', { exact: true }) }).last();
    await expect(margenOperativoPctCard).toContainText('%');

    // The inline proxy note is visible near the waterfall.
    await expect(adminPage.getByText('Compras se usa como proxy de costo directo', { exact: false })).toBeVisible();
  });
```

- [ ] **Step 3: Run the updated and new Finanzas tests**

Run (Node 20+ if needed): `bunx playwright test e2e/analitica.spec.ts -g "Finanzas tab"`
Expected: all Finanzas-related tests PASS, including the updated cash-flow-margin-card test and the new proxy-KPI test.

- [ ] **Step 4: Run the full file to confirm no regressions**

Run: `bunx playwright test e2e/analitica.spec.ts -g "@mssql"`
Expected: PASS (every test in the file).

- [ ] **Step 5: Commit**

```bash
git add e2e/analitica.spec.ts
git commit -m "test: cover the Finanzas Utilidad Bruta (proxy) waterfall and Margen Operativo %"
```

---

## Task 9: Migration `0027` — `DueDateKey` on `Fact_Collections` + `Load_Fact_Collections` update

**Files:**
- Create: `dwh-migrations/0027_fact_collections_due_date.sql`
- Test: `scripts/dwh/__tests__/fact-collections-due-date.test.ts`

**Interfaces:**
- Produces: `fact.Fact_Collections.DueDateKey INT NULL` (FK → `dim.Dim_Date`), and an updated `dwh.Load_Fact_Collections` procedure that populates it at load time by resolving each row's `InvoiceNumber` against `Ncake_a.dbo.saDocumentoVenta.fec_venc` (the same source column `dwh.Snapshot_Fact_AR` already uses for `Fact_AR_Snapshot.DueDate`, `dwh-migrations/0012_fact_ar_snapshot.sql:68`). Task 10 (CxC route) reads this new column.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0027_fact_collections_due_date.sql`:

```sql
-- Adds due-date lineage to fact.Fact_Collections so every collection row is
-- self-describing for aging-at-time-of-payment (Part 3a of
-- docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md),
-- without depending on the lossy point-in-time Fact_AR_Snapshot (which only
-- ever reflects "today's" open balances, not the state at each historical
-- payment's own moment). Sourced from Ncake_a.dbo.saDocumentoVenta.fec_venc
-- -- the exact same source column dwh.Snapshot_Fact_AR already uses for
-- Fact_AR_Snapshot.DueDate (dwh-migrations/0012_fact_ar_snapshot.sql:68),
-- so this is the second, independent consumer of that column, not a new
-- due-date concept.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('fact.Fact_Collections') AND name = 'DueDateKey'
)
    ALTER TABLE fact.Fact_Collections ADD DueDateKey int NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Fact_Collections_Dim_Date_DueDate'
)
    ALTER TABLE fact.Fact_Collections
    ADD CONSTRAINT FK_Fact_Collections_Dim_Date_DueDate FOREIGN KEY (DueDateKey) REFERENCES dim.Dim_Date(DateKey);
GO

-- Rewrite of dwh.Load_Fact_Collections (0011_fact_collections.sql), adding a
-- LEFT JOIN to Ncake_a.dbo.saDocumentoVenta on InvoiceNumber (= nro_doc) to
-- resolve DueDateKey -- and re-resolving it on every incremental run's
-- WHEN MATCHED branch too, not just at initial insert, since a rerun could
-- otherwise leave an existing row's DueDateKey stale if saDocumentoVenta's
-- fec_venc for that invoice changes after the payment was first loaded.
-- Everything else in this procedure (watermark logic, the Changed CTE, every
-- other column) is unchanged from 0011 -- see that file's own comments for
-- why the two-watermark-row strategy is used here.
--
-- Rows where the invoice can't be resolved against saDocumentoVenta (fully
-- historical/pre-DWH invoices, or a receipt line whose nro_doc doesn't match
-- any current saDocumentoVenta row) get DueDateKey = NULL via the LEFT JOIN
-- -- per the spec, these are excluded from the new weekday x
-- estado-de-vencimiento chart (Task 10) but unaffected everywhere else
-- Fact_Collections is already used.
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Collections
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobroDocReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobro');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.cob_num, r.co_tipo_doc, r.nro_doc,
            ISNULL(r.mont_cob, 0) AS mont_cob,
            ISNULL(r.monto_retencion_iva, 0) AS monto_retencion_iva,
            ISNULL(r.monto_retencion, 0) AS monto_retencion,
            ISNULL(r.dpcobro_monto, 0) AS dpcobro_monto,
            c.co_cli, c.co_ven, c.co_mone, c.tasa, c.fecha, ISNULL(c.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saCobroDocReng r
        INNER JOIN Ncake_a.dbo.saCobro c ON c.cob_num = r.cob_num
        WHERE r.fe_us_mo > @DetailWatermark OR c.validador > @HeaderWatermark
    )
    MERGE fact.Fact_Collections AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(ch.fecha, 'yyyyMMdd')) AS DateKey,
            ch.reng_num, ch.cob_num, ch.nro_doc,
            cust.CustomerKey, rep.SalesRepKey, cur.CurrencyKey, dt.DocumentTypeKey,
            ch.mont_cob AS AmountCollected, ch.monto_retencion_iva AS RetentionIVAAmount,
            ch.monto_retencion AS RetentionISLRAmount, ch.dpcobro_monto AS EarlyPaymentDiscountAmount,
            ch.tasa AS DocumentExchangeRate, ch.anulado AS IsVoided,
            dd.DateKey AS DueDateKey
        FROM Changed ch
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(ch.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(ch.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(ch.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(ch.co_tipo_doc) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN Ncake_a.dbo.saDocumentoVenta dv ON RTRIM(dv.nro_doc) = RTRIM(ch.nro_doc) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Date dd ON dd.DateKey = CONVERT(int, FORMAT(dv.fec_venc, 'yyyyMMdd'))
        WHERE cust.CustomerKey IS NOT NULL
    ) AS src
        ON tgt.ReceiptNumber = src.cob_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.InvoiceDocumentTypeKey = src.DocumentTypeKey,
        tgt.InvoiceNumber = src.nro_doc,
        tgt.AmountCollected = src.AmountCollected,
        tgt.RetentionIVAAmount = src.RetentionIVAAmount,
        tgt.RetentionISLRAmount = src.RetentionISLRAmount,
        tgt.EarlyPaymentDiscountAmount = src.EarlyPaymentDiscountAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.DueDateKey = src.DueDateKey,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, SalesRepKey, CurrencyKey, InvoiceDocumentTypeKey,
            ReceiptNumber, InvoiceNumber, LineNumber, AmountCollected, RetentionIVAAmount,
            RetentionISLRAmount, EarlyPaymentDiscountAmount, DocumentExchangeRate, IsVoided,
            DueDateKey
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.SalesRepKey, src.CurrencyKey, src.DocumentTypeKey,
            src.cob_num, src.nro_doc, src.reng_num, src.AmountCollected, src.RetentionIVAAmount,
            src.RetentionISLRAmount, src.EarlyPaymentDiscountAmount, src.DocumentExchangeRate, src.IsVoided,
            src.DueDateKey
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saCobroDocReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saCobro;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCobroDocReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saCobro';
END
GO
```

- [ ] **Step 2: Apply the migration and verify it runs cleanly**

Run: `bun run migrate:dwh`
Expected: no errors; `0027_fact_collections_due_date.sql` recorded in `dwh.__dwh_migrations`.

- [ ] **Step 3: Write the failing test**

Create `scripts/dwh/__tests__/fact-collections-due-date.test.ts`:

```typescript
// scripts/dwh/__tests__/fact-collections-due-date.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import sql from 'mssql';
import { runDwhMigrations, dwhDatabaseName } from '../../migrate-dwh';

function testConfig(database: string): sql.config {
  return {
    server: process.env.DW_SERVER ?? process.env.DB_SERVER!,
    port: parseInt(process.env.DW_PORT ?? process.env.DB_PORT ?? '1433'),
    database,
    user: process.env.DW_USER ?? process.env.DB_USER!,
    password: process.env.DW_PASSWORD ?? process.env.DB_PASSWORD!,
    options: {
      encrypt: (process.env.DW_ENCRYPT ?? process.env.DB_ENCRYPT) === 'true',
      trustServerCertificate: (process.env.DW_TRUST_SERVER_CERT ?? process.env.DB_TRUST_SERVER_CERT) !== 'false',
    },
  };
}

describe('fact.Fact_Collections.DueDateKey', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    await runDwhMigrations();
    pool = await new sql.ConnectionPool(testConfig(dwhDatabaseName())).connect();
    await pool.request().execute('dwh.Load_Dim_Currency');
    await pool.request().execute('dwh.Load_Dim_Customer');
    await pool.request().execute('dwh.Load_Dim_LegalEntity');
    await pool.request().execute('dwh.Load_Dim_Product');
    await pool.request().execute('dwh.Load_Dim_SalesRep');
    await pool.request().execute('dwh.Load_Dim_Warehouse');
    await pool.request().execute('dwh.Load_Fact_Collections');
  });

  afterAll(async () => {
    await pool.close();
    const masterPool = await new sql.ConnectionPool(testConfig('master')).connect();
    await masterPool.request().query(`
      ALTER DATABASE [${dwhDatabaseName()}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dwhDatabaseName()}];
    `);
    await masterPool.close();
  });

  test('DueDateKey column exists with a FK to Dim_Date', async () => {
    const result = await pool.request().query(`
      SELECT c.name AS ColumnName, fk.name AS ForeignKeyName
      FROM sys.columns c
      LEFT JOIN sys.foreign_key_columns fkc ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
      LEFT JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      WHERE c.object_id = OBJECT_ID('fact.Fact_Collections') AND c.name = 'DueDateKey'
    `);
    expect(result.recordset.length).toBe(1);
    expect(result.recordset[0].ForeignKeyName).toBe('FK_Fact_Collections_Dim_Date_DueDate');
  });

  test('at least one loaded row resolves a non-NULL DueDateKey when its invoice exists in saDocumentoVenta', async () => {
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total FROM fact.Fact_Collections WHERE DueDateKey IS NOT NULL
    `);
    // Reference test DB has real overlapping saCobro/saDocumentoVenta rows
    // (same reference dataset every other Fact_Collections test in this
    // suite already relies on) -- if this is ever 0 on a fresh seed, that's
    // a real regression in the join, not flaky test data.
    expect(Number(result.recordset[0].total)).toBeGreaterThan(0);
  });

  test('DueDateKey matches Fact_AR_Snapshot.DueDate for the same invoice (same source column, same value)', async () => {
    await pool.request().query(`EXEC dwh.Snapshot_Fact_AR`);
    const result = await pool.request().query(`
      SELECT TOP 5 fc.InvoiceNumber, fc.DueDateKey, dd.FullDate AS FactCollectionsDueDate, ar.DueDate AS SnapshotDueDate
      FROM fact.Fact_Collections fc
      JOIN dim.Dim_Date dd ON dd.DateKey = fc.DueDateKey
      JOIN fact.Fact_AR_Snapshot ar ON RTRIM(ar.InvoiceNumber) = RTRIM(fc.InvoiceNumber)
      WHERE fc.DueDateKey IS NOT NULL
    `);
    for (const row of result.recordset) {
      expect(new Date(row.FactCollectionsDueDate).toISOString().slice(0, 10)).toBe(
        new Date(row.SnapshotDueDate).toISOString().slice(0, 10)
      );
    }
  });

  test('re-running Load_Fact_Collections is idempotent and does not duplicate rows', async () => {
    const before = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    await pool.request().execute('dwh.Load_Fact_Collections');
    const after = await pool.request().query(`SELECT COUNT(*) AS total FROM fact.Fact_Collections`);
    expect(Number(after.recordset[0].total)).toBe(Number(before.recordset[0].total));
  });
});
```

Note: `dim.Dim_Date` needs no `Load_Dim_Date` call before `EXEC dwh.Snapshot_Fact_AR` — it is pre-seeded directly by migration `0003_dim_date.sql`'s own `INSERT` loop (2020-01-01 through 2035-12-31); no `Load_Dim_Date` stored procedure exists anywhere in this codebase.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test scripts/dwh/__tests__/fact-collections-due-date.test.ts --env-file=.env.local`
Expected: PASS (4/4). If a `beforeAll`/`afterAll` hook times out with a shared-SQL-Server contention error, retry the same command alone.

- [ ] **Step 5: Commit**

```bash
git add dwh-migrations/0027_fact_collections_due_date.sql scripts/dwh/__tests__/fact-collections-due-date.test.ts
git commit -m "feat: add DueDateKey to Fact_Collections, sourced from saDocumentoVenta.fec_venc"
```

---

## Task 10: CxC route — `DueDateKey`-backed weekday chart, DSO trend, aging trend, top-debtor avg días

**Files:**
- Modify: `app/api/dwh/cxc/route.ts`
- Modify: `app/(app)/analitica/types.ts`
- Test: `app/api/dwh/cxc/__tests__/route.test.ts` (already exists — extended, not created)

**Interfaces:**
- Consumes: `fact.Fact_Collections.DueDateKey` (Task 9), `fact.Fact_AR_Snapshot` (existing), `dim.Dim_Date` (existing, has `DayOfWeek`/`DayName`/`YearMonth` columns per `dwh-migrations/0003_dim_date.sql`), `fact.Fact_Sales`/`fact.Fact_Returns` (existing, for DSO's net-sales denominator), `getDimensionSpec`/`isClienteDimension` (existing, unchanged).
- Produces: `CxcResponse` gains four new fields (`weekdayVencimiento`, `dsoTrend`, `agingTrend`, and `topDebtors` rows gain `avgDaysToPay`) — see Step 1 for exact shapes. All four are additive; no existing `CxcResponse` field changes shape.

- [ ] **Step 1: Add the new types to `types.ts`**

In `app/(app)/analitica/types.ts`, find `DebtorRow` (original lines 57-60) and `CxcResponse` (original lines 125-132). Replace `DebtorRow`:

```typescript
export interface DebtorRow {
  name: string;
  outstanding: number;
  // Average (DateKey - DueDateKey) in days across this debtor's
  // Fact_Collections rows with a resolvable DueDateKey (0027's join) — null
  // when the debtor has no such rows (shown as "—" in the UI). Positive =
  // paid late on average, negative = paid early on average.
  avgDaysToPay: number | null;
}
```

Add these new interfaces directly after `CxcResponse`'s existing declaration, then extend `CxcResponse` itself:

```typescript
// Part 3b of docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md:
// one row per weekday (Lun-Dom), 3 amounts per row for the 3
// vencimiento-status series at time of payment.
export interface WeekdayVencimientoRow {
  weekday: string; // 'Lun' | 'Mar' | ... | 'Dom'
  venceHoy: number; // DateKey == DueDateKey
  vencida: number; // DateKey > DueDateKey
  noVencida: number; // DateKey < DueDateKey
}

// Part 3c: monthly DSO, independent of the CxC tab's own snapshot-only date
// handling — one point per month that has at least one Fact_AR_Snapshot run.
export interface DsoTrendRow {
  yearMonth: string;
  dso: number | null;
}

// Part 3d: existing aging buckets (Current/1-30/31-60/61-90/>90), trended
// monthly instead of a single MAX(SnapshotDateKey) snapshot.
export interface AgingTrendRow {
  yearMonth: string;
  buckets: AgingBucketRow[];
}

export interface CxcResponse {
  agingBuckets: AgingBucketRow[];
  topDebtors: DebtorRow[];
  overdueShare: number | null;
  snapshotDateKey: number | null;
  usdRate: number | null;
  weekdayVencimiento: WeekdayVencimientoRow[];
  dsoTrend: DsoTrendRow[];
  agingTrend: AgingTrendRow[];
}
```

- [ ] **Step 2: Confirm the baseline route test still passes before this task's changes**

The existing `app/api/dwh/cxc/__tests__/route.test.ts` only asserts the 401 auth gate — confirm it still exists unchanged (no new assertions needed there; DWH-reachable behavior for this task is covered by Steps 3-11's manual verification and Task 12's E2E tests, matching this project's established thin-route-test convention, same reasoning as Task 6 Step 2).

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts --env-file=.env.local`
Expected: PASS (1/1) — confirms the baseline before this task's changes.

- [ ] **Step 3: Add the weekday × vencimiento query**

In `app/api/dwh/cxc/route.ts`, add this function after the existing `topDebtorsQuery` function:

```typescript
// Part 3b: for each Fact_Collections row with a resolvable DueDateKey
// (0027_fact_collections_due_date.sql), bucket its AmountCollected into one
// of 3 vencimiento-status series based on comparing DateKey (payment date)
// to DueDateKey (invoice due date), then group by the payment date's
// weekday. dd (joined on fc.DateKey) supplies DayOfWeek/DayName; a second
// unaliased comparison against fc.DueDateKey needs no extra join since
// DateKey/DueDateKey are both plain int columns on Fact_Collections itself.
const WEEKDAY_VENCIMIENTO_QUERY = `
  SELECT
    dd.DayOfWeek,
    dd.DayName,
    SUM(CASE WHEN fc.DateKey = fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS VenceHoy,
    SUM(CASE WHEN fc.DateKey > fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS Vencida,
    SUM(CASE WHEN fc.DateKey < fc.DueDateKey THEN fc.AmountCollected ELSE 0 END) AS NoVencida
  FROM fact.Fact_Collections fc
  JOIN dim.Dim_Date dd ON dd.DateKey = fc.DateKey
  WHERE fc.IsVoided = 0 AND fc.DueDateKey IS NOT NULL
  GROUP BY dd.DayOfWeek, dd.DayName
  ORDER BY dd.DayOfWeek
`;

const WEEKDAY_ES_LABELS: Record<string, string> = {
  Sunday: 'Dom', Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié',
  Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb',
};
```

- [ ] **Step 4: Add the DSO trend query**

Add this function directly after the weekday query:

```typescript
// Part 3c: DSO = (AR balance at month end / net sales in a trailing period)
// x days in period — one point per YearMonth that has at least one
// Fact_AR_Snapshot run, using each month's LATEST snapshot as "month end"
// (there may be 0 or several snapshot runs within a given month, since the
// daily AR snapshot job is disabled by default -- see dwh-migrations/README.md's
// "Enabling the SQL Agent jobs" section). Net sales trailing period =
// the 90 days ending on that same snapshot date (fixed 90-day trailing
// window, independent of the CxC tab's own date handling, per the spec).
const DSO_TREND_QUERY = `
  SELECT
    d.YearMonth,
    MAX(a.SnapshotDateKey) AS MonthEndSnapshotDateKey
  FROM fact.Fact_AR_Snapshot a
  JOIN dim.Dim_Date d ON d.DateKey = a.SnapshotDateKey
  GROUP BY d.YearMonth
  ORDER BY d.YearMonth
`;

function dsoForSnapshotQuery(): string {
  return `
    DECLARE @Balance decimal(18,2) = (
      SELECT ISNULL(SUM(OutstandingBalance), 0) FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = @snapshotDateKey AND IsCreditNote = 0
    );
    DECLARE @TrailingStart int = (
      SELECT CONVERT(int, FORMAT(DATEADD(day, -90, CAST(CAST(@snapshotDateKey AS varchar(8)) AS date)), 'yyyyMMdd'))
    );
    DECLARE @NetSales decimal(18,2) = (
      SELECT ISNULL(SUM(fs.NetAmount), 0) FROM fact.Fact_Sales fs
      WHERE fs.IsVoided = 0 AND fs.DateKey >= @TrailingStart AND fs.DateKey <= @snapshotDateKey
    );
    SELECT @Balance AS Balance, @NetSales AS NetSales;
  `;
}
```

- [ ] **Step 5: Add the aging trend query**

Add this function directly after the DSO functions:

```typescript
// Part 3d: same 5 buckets as the existing single-snapshot aging chart
// (tab-cxc.tsx's BUCKET_ORDER/BUCKET_COLORS), trended across every distinct
// SnapshotDateKey instead of just MAX(SnapshotDateKey). Ordered so the UI
// can render oldest-to-newest without a client-side sort.
const AGING_TREND_QUERY = `
  SELECT a.SnapshotDateKey, a.AgingBucket, SUM(a.OutstandingBalance) AS Amount
  FROM fact.Fact_AR_Snapshot a
  WHERE a.IsCreditNote = 0
  GROUP BY a.SnapshotDateKey, a.AgingBucket
  ORDER BY a.SnapshotDateKey
`;
```

- [ ] **Step 6: Add `avgDaysToPay` to the top-debtors query**

Find the existing `topDebtorsQuery` function and replace it entirely (it currently queries `Fact_AR_Snapshot` only — this adds a correlated subquery against `Fact_Collections` for the new column, reusing the dimension's own `correlate()` mechanism the same way `tab-ventas.tsx`'s clienteQuery already does for Fact_Returns):

```typescript
function topDebtorsQuery(dimension: Dimension): string {
  const spec = getDimensionSpec(dimension);
  const { innerJoin, condition } = spec.correlate('a', 'fc2');
  return `
    SELECT TOP 10
      ${spec.labelExpr} AS Name,
      SUM(a.OutstandingBalance) AS Outstanding,
      (
        SELECT AVG(CAST(fc2.DateKey - fc2.DueDateKey AS float))
        FROM fact.Fact_Collections fc2
        ${innerJoin}
        WHERE fc2.IsVoided = 0 AND fc2.DueDateKey IS NOT NULL AND ${condition}
      ) AS AvgDaysToPay
    FROM fact.Fact_AR_Snapshot a
    ${spec.joinClause.replace(/\bf\b/g, 'a')}
    WHERE a.SnapshotDateKey = @snapshotDateKey
    GROUP BY ${spec.groupByColumn}
    HAVING SUM(a.OutstandingBalance) > 0
    ORDER BY Outstanding DESC
  `;
}
```

- [ ] **Step 7: Wire all four additions into `GET`**

In `export async function GET`, find the `if (snapshotDateKey !== null) { ... }` block (original lines 67-74) and replace it with:

```typescript
    let agingBuckets: { AgingBucket: string; Amount: number }[] = [];
    let topDebtors: { Name: string; Outstanding: number; AvgDaysToPay: number | null }[] = [];
    let weekdayRows: { DayOfWeek: number; DayName: string; VenceHoy: number; Vencida: number; NoVencida: number }[] = [];
    let agingTrendRows: { SnapshotDateKey: number; AgingBucket: string; Amount: number }[] = [];
    let dsoMonths: { YearMonth: string; MonthEndSnapshotDateKey: number }[] = [];

    // Weekday x vencimiento and aging-trend queries don't depend on
    // "latest" snapshot — they read across all of Fact_Collections/
    // Fact_AR_Snapshot's history, so they run regardless of whether a
    // snapshot has ever been taken, unlike the two snapshot-scoped queries
    // below (kept inside the snapshotDateKey !== null guard, unchanged).
    const [weekdayResult, agingTrendResult] = await Promise.all([
      pool.request().query(WEEKDAY_VENCIMIENTO_QUERY),
      pool.request().query(AGING_TREND_QUERY),
    ]);
    weekdayRows = weekdayResult.recordset;
    agingTrendRows = agingTrendResult.recordset;

    if (snapshotDateKey !== null) {
      const [aging, debtors, dsoMonthsResult] = await Promise.all([
        pool.request().input('snapshotDateKey', snapshotDateKey).query(AGING_BUCKETS_QUERY),
        pool.request().input('snapshotDateKey', snapshotDateKey).query(topDebtorsQuery(clienteDimension)),
        pool.request().query(DSO_TREND_QUERY),
      ]);
      agingBuckets = aging.recordset;
      topDebtors = debtors.recordset;
      dsoMonths = dsoMonthsResult.recordset;
    }

    // DSO needs one extra scalar query PER month-end snapshot (each month's
    // own balance/net-sales pair) -- run them in parallel rather than
    // sequentially, same pattern as every other Promise.all in this route.
    const dsoTrend: DsoTrendRow[] = await Promise.all(
      dsoMonths.map(async m => {
        const req = pool.request();
        req.input('snapshotDateKey', m.MonthEndSnapshotDateKey);
        const result = await req.query(dsoForSnapshotQuery());
        const row = result.recordsets[result.recordsets.length - 1][0] as { Balance: number; NetSales: number } | undefined;
        const balance = Number(row?.Balance ?? 0);
        const netSales = Number(row?.NetSales ?? 0);
        return { yearMonth: m.YearMonth, dso: netSales > 0 ? (balance / netSales) * 90 : null };
      })
    );
```

Immediately after, add the mapping/grouping logic for the three new response shapes (directly before the existing `agingBucketsMapped`/`topDebtorsMapped` mapping block — leave that block's own mapping of `agingBuckets`/`topDebtors` in place, just update `topDebtorsMapped` to carry the new field):

```typescript
    const weekdayVencimiento: WeekdayVencimientoRow[] = weekdayRows.map(r => ({
      weekday: WEEKDAY_ES_LABELS[r.DayName] ?? r.DayName,
      venceHoy: Number(r.VenceHoy),
      vencida: Number(r.Vencida),
      noVencida: Number(r.NoVencida),
    }));

    const agingTrendByMonth = new Map<string, AgingBucketRow[]>();
    for (const r of agingTrendRows) {
      // SnapshotDateKey is an int like 20260915 -- slice to YYYY-MM without
      // an extra Dim_Date join, same int->string convention formatSnapshotDate
      // already uses client-side in tab-cxc.tsx.
      const s = String(r.SnapshotDateKey);
      const yearMonth = `${s.slice(0, 4)}-${s.slice(4, 6)}`;
      const existing = agingTrendByMonth.get(yearMonth) ?? [];
      existing.push({ bucket: r.AgingBucket, amount: Number(r.Amount) });
      agingTrendByMonth.set(yearMonth, existing);
    }
    const agingTrend: AgingTrendRow[] = Array.from(agingTrendByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, buckets]) => ({ yearMonth, buckets }));
```

Finally, update the existing `topDebtorsMapped` mapping (original lines 81-84) to carry the new field:

```typescript
    const topDebtorsMapped: DebtorRow[] = topDebtors.map(r => ({
      name: r.Name,
      outstanding: Number(r.Outstanding),
      avgDaysToPay: r.AvgDaysToPay !== null && r.AvgDaysToPay !== undefined ? Number(r.AvgDaysToPay) : null,
    }));
```

And add the three new fields to the final `response` object (leave every existing field as-is):

```typescript
    const response: CxcResponse = {
      agingBuckets: agingBucketsMapped,
      topDebtors: topDebtorsMapped,
      overdueShare,
      snapshotDateKey,
      usdRate,
      weekdayVencimiento,
      dsoTrend,
      agingTrend,
    };
```

Add `WeekdayVencimientoRow`, `DsoTrendRow`, `AgingTrendRow` to the existing type-only import line at the top of the file.

- [ ] **Step 8: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 9: Manually verify against the live local DWH**

If practical: `bun dev`, then as a logged-in admin fetch `/api/dwh/cxc?currency=bs` directly and confirm the JSON response includes non-empty (or plausibly empty, if the reference DB's snapshot job has never run) `weekdayVencimiento`/`dsoTrend`/`agingTrend` arrays, and that `topDebtors` rows carry an `avgDaysToPay` key (number or `null`). If a dev server isn't practical, a careful read-through of Step 7's wiring is an acceptable substitute — note which you did.

- [ ] **Step 10: Run the existing CxC route test**

Run: `bun test app/api/dwh/cxc/__tests__/route.test.ts --env-file=.env.local`
Expected: PASS (1/1) — confirms nothing broke.

- [ ] **Step 11: Commit**

```bash
git add app/api/dwh/cxc/route.ts "app/(app)/analitica/types.ts"
git commit -m "feat: add weekday/DSO/aging-trend queries and avgDaysToPay to CxC route"
```

---

## Task 11: CxC tab — weekday chart, DSO trend, aging trend, top-debtor avg días column

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-cxc.tsx`

**Interfaces:**
- Consumes: `CxcResponse.weekdayVencimiento`/`dsoTrend`/`agingTrend` (Task 10, new fields), `DebtorRow.avgDaysToPay` (Task 10, new field). `CxcResponse`'s existing fields (`agingBuckets`, `topDebtors`, `overdueShare`, `snapshotDateKey`, `usdRate`) are unchanged.
- Produces: no new exports — `TabCxc`'s prop signature is unchanged.

- [ ] **Step 1: Extend the recharts import**

In `app/(app)/analitica/tabs/tab-cxc.tsx`, replace the existing recharts import block:

```tsx
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
```

with:

```tsx
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
```

- [ ] **Step 2: Add a "Días promedio de pago" column to the top-debtors table**

Find the top-debtors `<table>` (original lines 186-204) and replace its `<thead>`/`<tbody>` with:

```tsx
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Saldo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Días prom. de pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topDebtors.map((d, i) => (
                    <tr key={d.name} className={i % 2 === 1 ? 'bg-gray-50' : undefined}>
                      <td className="px-3 py-2 text-gray-800">{d.name}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {moneyLabel(d.outstanding, currency, rate)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {d.avgDaysToPay !== null ? d.avgDaysToPay.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
```

- [ ] **Step 3: Add the weekday × vencimiento chart**

Directly after the closing `</div>` of the `grid grid-cols-1 lg:grid-cols-2 gap-6` block (which contains the AR aging chart and top-debtors table, original lines 135-207), add a new section:

```tsx
      {/* Weekday x vencimiento */}
      <ChartCard
        title="Cobros por día de semana y estado de vencimiento"
        subtitle="Monto cobrado, agrupado por día de la semana del pago y si la factura ya había vencido en ese momento"
      >
        {data.weekdayVencimiento.length === 0 ? (
          <EmptyState message="Sin cobros con fecha de vencimiento resolvible todavía." />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.weekdayVencimiento}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="weekday" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="noVencida" name="Aún no vencía" stackId="v" fill="#16a34a" />
              <Bar dataKey="venceHoy" name="Vencía ese día" stackId="v" fill="#eab308" />
              <Bar dataKey="vencida" name="Ya estaba vencida" stackId="v" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
```

- [ ] **Step 4: Add the DSO trend chart**

Directly after the weekday `<ChartCard>`, add:

```tsx
      {/* DSO trend */}
      <ChartCard
        title="Tendencia de DSO (Days Sales Outstanding)"
        subtitle="Saldo de cartera al cierre de cada mes con snapshot / ventas netas de los 90 días previos × 90"
      >
        {data.dsoTrend.filter(d => d.dso !== null).length === 0 ? (
          <EmptyState message="Se necesita más de un snapshot de cuentas por cobrar (fact.Fact_AR_Snapshot) para trazar una tendencia." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dsoTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val: unknown) => (val === null ? 'Sin datos' : `${Number(val).toFixed(1)} días`)} />
              <Line type="monotone" dataKey="dso" name="DSO (días)" stroke="#2563eb" strokeWidth={2} dot connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
```

- [ ] **Step 5: Add the aging bucket trend chart**

Directly after the DSO `<ChartCard>`, add:

```tsx
      {/* Aging trend */}
      <ChartCard
        title="Tendencia de antigüedad de saldos"
        subtitle="Misma clasificación (Current/1-30/31-60/61-90/>90) que el corte actual, trazada mes a mes"
      >
        {data.agingTrend.length === 0 ? (
          <EmptyState message="Se necesita al menos un snapshot de cuentas por cobrar (fact.Fact_AR_Snapshot) para trazar esta tendencia." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={data.agingTrend.map(row => {
                const flat: Record<string, string | number> = { yearMonth: row.yearMonth };
                for (const bucket of BUCKET_ORDER) {
                  flat[bucket] = row.buckets.find(b => b.bucket === bucket)?.amount ?? 0;
                }
                return flat;
              })}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
              <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BUCKET_ORDER.map(bucket => (
                <Area
                  key={bucket}
                  type="monotone"
                  dataKey={bucket}
                  name={bucket}
                  stackId="aging"
                  stroke={BUCKET_COLORS[bucket]}
                  fill={BUCKET_COLORS[bucket]}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
```

This reuses the existing `BUCKET_ORDER`/`BUCKET_COLORS` constants already declared at the top of the file (original lines 10-17) — no new constant needed.

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 7: Manually verify in a browser, or read-through if a dev server isn't practical**

If practical: `bun dev`, navigate to `/analitica?tab=cxc`. Confirm: the top-debtors table gains a "Días prom. de pago" column (numeric or "—"), a new "Cobros por día de semana y estado de vencimiento" stacked bar chart renders below the existing aging/debtors grid, a "Tendencia de DSO" line chart and a "Tendencia de antigüedad de saldos" stacked area chart both render (or show their respective `EmptyState` messages if the reference DB has 0-1 snapshot runs, which is expected and correct per Task 10's design). If not practical, a JSX read-through plus the passing type-check substitutes — note which you did.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/analitica/tabs/tab-cxc.tsx"
git commit -m "feat: add weekday/DSO/aging-trend charts and avgDaysToPay column to CxC tab"
```

---

## Task 12: E2E coverage for the four new CxC additions

**Files:**
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: the rendered CxC tab from Task 11.

There is no pre-existing CxC test in this file — this task adds the first one, following the same `adminPage`/structural-presence assertion style as every other test in the file (seed-data-dependent exact values are avoided; structure and non-crashing are asserted).

- [ ] **Step 1: Add the CxC coverage test**

Add this test to `e2e/analitica.spec.ts`, after the `'Compras tab renders all three sections at once...'` test added in Task 5:

```typescript
  test('CxC tab renders the weekday, DSO trend, aging trend charts and the avg-días-de-pago debtor column', async ({ adminPage }) => {
    await adminPage.goto('/analitica?tab=cxc');

    // Existing AR aging chart + top-debtors table still render (baseline,
    // unaffected by this task's additions).
    await expect(adminPage.getByRole('heading', { name: 'Antigüedad de saldos (AR Aging)' })).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByRole('heading', { name: 'Mayor concentración de crédito' })).toBeVisible();

    // New top-debtors column (Part 3e) — header always renders even when
    // the table has 0 rows in a given seed, so this doesn't depend on
    // topDebtors being non-empty.
    await expect(adminPage.getByRole('columnheader', { name: 'Días prom. de pago' })).toBeVisible();

    // New weekday x vencimiento chart (Part 3b) — always renders its
    // ChartCard heading; the chart itself may show an EmptyState if no
    // Fact_Collections row has a resolvable DueDateKey in this seed, so this
    // asserts the heading and card presence rather than bar content.
    await expect(adminPage.getByRole('heading', { name: 'Cobros por día de semana y estado de vencimiento' })).toBeVisible();

    // New DSO trend chart (Part 3c).
    await expect(adminPage.getByRole('heading', { name: 'Tendencia de DSO (Days Sales Outstanding)' })).toBeVisible();

    // New aging bucket trend chart (Part 3d).
    await expect(adminPage.getByRole('heading', { name: 'Tendencia de antigüedad de saldos' })).toBeVisible();
  });
```

- [ ] **Step 2: Run the new test**

Run (Node 20+ if needed): `bunx playwright test e2e/analitica.spec.ts -g "CxC tab renders"`
Expected: PASS.

- [ ] **Step 3: Run the full file one final time**

Run: `bunx playwright test e2e/analitica.spec.ts -g "@mssql"`
Expected: all tests PASS — this is the last full-file regression check before Part 4's cleanup task.

- [ ] **Step 4: Commit**

```bash
git add e2e/analitica.spec.ts
git commit -m "test: cover weekday/DSO/aging-trend charts and avg-días-de-pago column in CxC E2E"
```

---

## Task 13: Cleanup — remove dead `Fact_Sales`-waterfall code from Finanzas route/types

**Files:**
- Modify: `app/api/dwh/finanzas/route.ts`
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FinanzasResponse` drops the `waterfall` field entirely (Task 7's tab component already stopped reading it) — `FinanzasWaterfallStep` is deleted from `types.ts`. `cashFlowEbitda`, `margenProxy`, `expenseBreakdown`, `usdRate` are unchanged.

By this point in the plan (after Tasks 6-8), nothing reads `FinanzasResponse.waterfall` anymore — Task 7 rewrote `tab-finanzas.tsx` to read `margenProxy` instead. This task deletes the now-fully-dead code that computes it.

- [ ] **Step 1: Confirm nothing still reads `data.waterfall` before deleting its source**

Run: `grep -rn "\.waterfall\b" "app/(app)/analitica" app/api/dwh/finanzas`
Expected: no output (or only a match inside a comment/test fixture unrelated to the live data flow — inspect any hit before proceeding; if a real usage remains, stop and re-run Task 7 first).

- [ ] **Step 2: Remove the dead waterfall computation from `app/api/dwh/finanzas/route.ts`**

Delete the `waterfallTotalsQuery` function (original lines 21-32) entirely, along with its preceding comment block (original lines 9-19, the `// Reads from the pre-aggregated...` / `// COGSAmount/GrossProfitAmount are nullable...` comment — this comment specifically describes the old waterfall's now-deleted `ISNULL`-wrapping rationale; replace it with a shorter one, shown below).

Add this comment in its place, directly above `function salesNetQuery`:

```typescript
// Reads from the pre-aggregated dwh/dim/fact schema in DWH_AlimentosNY (see
// dwh-migrations/), not the raw Profit Plus ERP — no COLLATE/RTRIM
// gymnastics needed here, that work already happened at load time.
```

In `export async function GET`, remove only the `pool.request().query(waterfallTotalsQuery(salesDateWhere))` entry from the `Promise.all([...])` array (and its corresponding `totals` destructured variable) — `const salesDateWhere = buildDateWhereClause(dateRange, 'fs');` itself stays, since `salesNetQuery` still uses it. Delete the whole block that builds `waterfall`:

```typescript
    const row = totals.recordset[0] ?? {
      GrossAmount: 0,
      DiscountAmount: 0,
      NetAmount: 0,
      COGSAmount: 0,
      GrossProfitAmount: 0,
    };

    const grossAmount = Number(row.GrossAmount);
    const discountAmount = Number(row.DiscountAmount);
    const netAmount = Number(row.NetAmount);
    const cogsAmount = Number(row.COGSAmount);
    const grossProfitAmount = Number(row.GrossProfitAmount);

    const waterfall: FinanzasWaterfallStep[] = [
      { step: 'Bruto', amount: grossAmount, cumulative: grossAmount },
      { step: 'Descuento', amount: -discountAmount, cumulative: grossAmount - discountAmount },
      { step: 'Neto', amount: netAmount, cumulative: netAmount },
      { step: 'COGS', amount: -cogsAmount, cumulative: netAmount - cogsAmount },
      { step: 'Utilidad Bruta', amount: grossProfitAmount, cumulative: grossProfitAmount },
    ];
```

Remove the `waterfall,` line from the final `response` object literal, so it reads:

```typescript
    const response: FinanzasResponse = {
      cashFlowEbitda: {
        ingresosOperativos,
        gastosOperativos,
        ebitda,
        intereses,
        impuestos,
        utilidadNeta,
      },
      margenProxy,
      expenseBreakdown,
      usdRate,
    };
```

Remove `FinanzasWaterfallStep` from the top-of-file type-only import (keep `FinanzasResponse`, `ExpenseCategoryRow`, `MargenProxy`).

- [ ] **Step 3: Remove `FinanzasWaterfallStep` and the `waterfall` field from `types.ts`**

In `app/(app)/analitica/types.ts`, delete the `FinanzasWaterfallStep` interface entirely:

```typescript
export interface FinanzasWaterfallStep {
  step: string; // 'Bruto' → 'Descuento' → 'Neto' → 'COGS' → 'Utilidad'
  amount: number;
  cumulative: number;
}
```

Remove the `waterfall: FinanzasWaterfallStep[];` field from `FinanzasResponse`, so it reads:

```typescript
export interface FinanzasResponse {
  cashFlowEbitda: CashFlowEbitda;
  margenProxy: MargenProxy;
  expenseBreakdown: ExpenseCategoryRow[];
  usdRate: number | null;
}
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: zero new errors — confirms no other file still imports `FinanzasWaterfallStep` or reads `.waterfall` (Step 1's grep already confirmed this at the source level; this step confirms it at the type level too).

- [ ] **Step 5: Run the finanzas route and margen-proxy tests**

Run: `bun test app/api/dwh/finanzas/__tests__/route.test.ts app/api/dwh/finanzas/__tests__/margen-proxy.test.ts --env-file=.env.local`
Expected: PASS (all tests — `computeMargenProxy` doesn't depend on the deleted waterfall code at all, and the 401/no-cache tests don't touch response body shape).

- [ ] **Step 6: Run the Finanzas E2E tests**

Run (Node 20+ if needed): `bunx playwright test e2e/analitica.spec.ts -g "Finanzas tab"`
Expected: all PASS (Task 8 already updated every assertion that touched the old waterfall's chart content).

- [ ] **Step 7: Commit**

```bash
git add app/api/dwh/finanzas/route.ts "app/(app)/analitica/types.ts"
git commit -m "refactor: remove dead Fact_Sales-based waterfall code from Finanzas route and types"
```

---

## Task 14: Cleanup verification — confirm no leftover unused state in the three flattened tabs

**Files:**
- Verify only: `app/(app)/analitica/tabs/tab-ventas.tsx`, `app/(app)/analitica/tabs/tab-compras.tsx`, `app/(app)/analitica/tabs/tab-devoluciones.tsx`

**Interfaces:**
- Consumes: the flattened tabs from Tasks 2-4.

Tasks 2-4 already removed the obvious dead symbols (`GROUP_BY_OPTIONS`/`GROUP_OPTIONS`, `groupBy`/`setGroupBy` state, `handleGroupByChange`, `handleBreadcrumbClick`, `subtitleByGroupBy`, `groupLabel`) inline as part of each rewrite. This task is a dedicated sweep to catch anything an inline rewrite might have missed, since the spec calls out "no leftover unused state/props" as its own explicit cleanup requirement.

- [ ] **Step 1: Run ESLint's unused-vars check against all three files**

Run: `bunx eslint "app/(app)/analitica/tabs/tab-ventas.tsx" "app/(app)/analitica/tabs/tab-compras.tsx" "app/(app)/analitica/tabs/tab-devoluciones.tsx"`
Expected: no `no-unused-vars` (or equivalent TypeScript unused-import/unused-local) warnings. If any appear, remove the flagged symbol and re-run.

- [ ] **Step 2: Grep for any remaining reference to the deleted toggle symbols**

Run: `grep -n "GROUP_BY_OPTIONS\|GROUP_OPTIONS\b\|handleGroupByChange\|handleBreadcrumbClick\|subtitleByGroupBy\|groupLabel\b" "app/(app)/analitica/tabs/tab-ventas.tsx" "app/(app)/analitica/tabs/tab-compras.tsx" "app/(app)/analitica/tabs/tab-devoluciones.tsx"`
Expected: no output. If any line prints, it's a leftover from Tasks 2-4's rewrite — remove it.

- [ ] **Step 3: Type-check one final time**

Run: `bunx tsc --noEmit`
Expected: zero errors from these three files.

- [ ] **Step 4: Commit (only if Steps 1-2 found and fixed something; otherwise skip this task's commit — nothing changed)**

```bash
git add "app/(app)/analitica/tabs/tab-ventas.tsx" "app/(app)/analitica/tabs/tab-compras.tsx" "app/(app)/analitica/tabs/tab-devoluciones.tsx"
git commit -m "refactor: remove leftover unused view-selector state from flattened tabs"
```

---

## Task 15: Doc corrections — "wired to auto-populate" language + Finanzas waterfall/margin section

**Files:**
- Modify: `docs/DATA_WAREHOUSE_GUIDE.md`
- Modify: `dwh-migrations/README.md`
- Modify: `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`

**Interfaces:**
- Consumes: nothing — pure documentation edits, no code interfaces involved.

- [ ] **Step 1: Correct `docs/DATA_WAREHOUSE_GUIDE.md`'s "wired to auto-populate" claim (line 217 area)**

In `docs/DATA_WAREHOUSE_GUIDE.md`, find (in the `#### Fact_Sales` section, "Cost Data Gap" callout):

```markdown
**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) **cannot be built from ERP data as it exists today**. The `UnitCost`/`COGSAmount`/`GrossProfitAmount` columns are wired into the schema and will populate automatically when cost data starts flowing, but do not build margin dashboards until this gap is resolved. See design spec §2 and §8 for details.
```

Replace with:

```markdown
**Impact**: Margin dashboards (Gross Margin Waterfall, Margin by Product) **cannot be built from ERP data as it exists today**. The `UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist as a reserved-but-unwired schema slot for a future cost source — `dwh.Load_Fact_Sales` currently inserts them as hardcoded `NULL, NULL, NULL, 'NO_COST_DATA'` with no join to any cost table at all (`dwh-migrations/0009_fact_sales.sql:117-122`), so nothing will populate them automatically; an upstream costing process AND a corresponding `Load_Fact_Sales` code change are both required before these columns hold real data. Do not build margin dashboards until this gap is resolved. See design spec §2 and §8 for details. (2026-09-15: the Finanzas tab's Margen Operativo now uses a Compras-based proxy for gross margin instead of waiting on this column — see the "Margen Operativo" workaround section below.)
```

- [ ] **Step 2: Correct the same "wired to auto-populate" claim in the "Known Limitations & Gaps" section (line 557 area)**

In the same file's "### 1. Cost Data Gap ⚠️" section, find:

```markdown
**Workaround**: `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist and are wired to auto-populate when cost data flows; currently always `NULL` with `CostSourceFlag = 'NO_COST_DATA'`.
```

Replace with:

```markdown
**Workaround**: `Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` columns exist as a reserved schema slot for a future cost source but are **not** wired to any live data path — `dwh.Load_Fact_Sales` inserts them as hardcoded `NULL, NULL, NULL, 'NO_COST_DATA'` (`dwh-migrations/0009_fact_sales.sql:117-122`), with no join to any cost table. Populating them for real requires both an upstream costing process in Profit Plus AND a `Load_Fact_Sales` code change — this is not automatic.
```

- [ ] **Step 3: Add the Part 2 waterfall/margin restructure to the "Margen Operativo" workaround section**

Directly after the existing "**Accrual revision (2026-09-15):**" paragraph (original lines 569-578, ending "...see `docs/superpowers/specs/2026-09-15-margen-operativo-accrual-design.md`."), add a new paragraph:

```markdown
**Utilidad Bruta (proxy) addition (2026-09-15):** the Finanzas tab's old
`Fact_Sales`-based waterfall (`Bruto → Descuento → Neto → COGS → Utilidad
Bruta`) was always `0`/unusable for margin reporting, for the same Cost Data
Gap reason documented above — it has been removed. In its place, the
waterfall now shows a **proxy** gross margin using Compras as a stand-in for
COGS: `Utilidad Bruta (proxy) = Ingresos Operativos − Compras` (where
Compras is the `dwh.vw_GastosOperativos` `'Compras'` category, i.e.
`Fact_Purchases`), with `Margen Bruto % = Utilidad Bruta / Ingresos`. This is
explicitly a proxy (Compras ≠ COGS — it includes non-resold purchases and
excludes labor/overhead), distinct from Margen Operativo (which nets against
*all* of `dwh.vw_GastosOperativos`, not just Compras): `Margen Operativo =
Utilidad Bruta (proxy) − Otros Gastos Operativos` (`dwh.vw_GastosOperativos`
minus its Compras rows), with `Margen Operativo % = Margen Operativo /
Ingresos`. Both percentages are new fields on the Finanzas API response
(`FinanzasResponse.margenProxy`) — see
`docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md` Part 2.
```

- [ ] **Step 4: Correct `dwh-migrations/README.md`'s "wired into the schema" claim**

In `dwh-migrations/README.md`, find (under "## Margin/cost data — deferred"):

```markdown
`Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` are wired into the schema but always `NULL` (`CostSourceFlag = 'NO_COST_DATA'`) as of this plan. See `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md` §1/§2/§8 — no finished-goods production cost has ever been recorded in Profit Plus for this installation. Do not build a margin dashboard against these columns until that upstream gap is resolved and this note is removed.
```

Replace with:

```markdown
`Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount` exist in the schema as a reserved-but-unwired slot, always `NULL` (`CostSourceFlag = 'NO_COST_DATA'`) — `dwh.Load_Fact_Sales` inserts them as hardcoded `NULL, NULL, NULL, 'NO_COST_DATA'` with no join to any cost source (`0009_fact_sales.sql:117-122`), not "wired" to anything that would populate them automatically. See `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md` §1/§2/§8 — no finished-goods production cost has ever been recorded in Profit Plus for this installation. Do not build a margin dashboard against these columns until that upstream gap is resolved and this note is removed. (The Finanzas tab's Margen Operativo instead uses a Compras-based proxy for gross margin — see `docs/DATA_WAREHOUSE_GUIDE.md`'s Cost Data Gap section.)
```

- [ ] **Step 5: Correct `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`'s "wired up so it activates automatically" claim**

In `docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`, find the `UnitCost` row of the `Fact_Sales` column table (original line 82):

```markdown
| `UnitCost` | `saCostoHistoricoSalida.costo_pro` joined via `saArticulo.rowguid` + `doc_orig`, when non-zero | **Currently always `NULL`** — verified live that every `costo_pro` value in this table is `0` for this installation (§2). Column and join wired up so it activates automatically the day real cost data appears upstream, but do not build a margin dashboard against it yet. |
```

Replace with:

```markdown
| `UnitCost` | `saCostoHistoricoSalida.costo_pro` joined via `saArticulo.rowguid` + `doc_orig`, when non-zero | **Currently always `NULL`** — verified live that every `costo_pro` value in this table is `0` for this installation (§2). **Correction (2026-09-15):** the join described in this row was never actually implemented — `dwh.Load_Fact_Sales` as built inserts `UnitCost`/`COGSAmount`/`GrossProfitAmount` as hardcoded `NULL` with no join at all (`dwh-migrations/0009_fact_sales.sql:117-122`), not a conditional join that merely finds zero rows. The column is a reserved schema slot, not "wired up" to anything — populating it for real requires both an upstream costing process AND writing this join. Do not build a margin dashboard against it yet; see `docs/DATA_WAREHOUSE_GUIDE.md`'s Cost Data Gap section for the Finanzas tab's Compras-proxy workaround instead. |
```

This file is a historical point-in-time design spec (normally left unedited once superseded, per this project's convention — see `docs/superpowers/plans/2026-09-15-margen-operativo-accrual.md`'s own Task 6 Step 4 note on `docs/superpowers/plans/`/`specs/` files). This correction is a deliberate, spec-mandated exception (the design spec this plan implements explicitly names this file and line as needing correction) — do not treat this as license to edit other historical spec/plan files.

- [ ] **Step 6: Proofread all three files' diffs**

Run: `git diff docs/DATA_WAREHOUSE_GUIDE.md dwh-migrations/README.md docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md`
Expected: only the four edits from Steps 1-3 and 5 above — no accidental whitespace/formatting changes elsewhere in these files.

- [ ] **Step 7: Commit**

```bash
git add docs/DATA_WAREHOUSE_GUIDE.md dwh-migrations/README.md docs/superpowers/specs/2026-08-25-sales-margin-collections-dwh-design.md
git commit -m "docs: correct stale 'wired to auto-populate' cost-column claims, document Utilidad Bruta proxy"
```

---

## Task 16: Full test suite + DB-backed live validation pass

**Files:**
- No new files — this task runs and reports on existing tooling.

**Interfaces:**
- Consumes: every task in this plan.

This is the final gate: confirm the whole test suite passes together (not just each task's own isolated test run) and confirm the new SQL (Task 9's `DueDateKey` backfill, Task 6's proxy waterfall math) produces sane numbers against real DWH data — not just passing unit tests, per this project's "live-verified" investigation convention (see `docs/DATA_WAREHOUSE_GUIDE.md`'s repeated "live-verified"/"verified live" callouts and `dwh-migrations/0024_nomina_cost_center.sql`'s header comment for the established style: state the live query, state the live result, state the conclusion).

- [ ] **Step 1: Run the full non-DWH unit test suite**

Run: `bun run test:unit`
Expected: PASS — every `bun:test` file except the excluded `compras-export.integration.test.ts` and `e2e/**`.

- [ ] **Step 2: Run every DWH-touching test file individually (not batched — shared SQL Server instance)**

Run each of the following one at a time, per this project's established constraint (`docs/superpowers/plans/2026-09-15-margen-operativo-accrual.md`'s Global Constraints — DWH tests must run one file at a time, never the full batch, due to lock contention on the shared local SQL Server instance):

```bash
bun test scripts/dwh/__tests__/vw-gastos-operativos.test.ts --env-file=.env.local
bun test scripts/dwh/__tests__/fact-collections-due-date.test.ts --env-file=.env.local
bun test scripts/dwh/__tests__/fact-collections.test.ts --env-file=.env.local
bun test scripts/dwh/__tests__/fact-ar-snapshot.test.ts --env-file=.env.local
bun test scripts/dwh/__tests__/full-pipeline-smoke.test.ts --env-file=.env.local
bun test scripts/dwh/__tests__/migrate-dwh.test.ts --env-file=.env.local
bun test app/api/dwh/finanzas/__tests__/route.test.ts --env-file=.env.local
bun test app/api/dwh/finanzas/__tests__/margen-proxy.test.ts --env-file=.env.local
bun test app/api/dwh/cxc/__tests__/route.test.ts --env-file=.env.local
bun test app/api/dwh/lib/__tests__/query-builder.test.ts --env-file=.env.local
```

Expected: every file PASSES. If any file times out with a lock-contention error, retry that single file alone (not the whole batch) — this is the documented, known pre-existing environment characteristic, not a code defect.

- [ ] **Step 3: Run the full Playwright `@mssql` suite for `analitica.spec.ts`**

Run (Node 20+ if your default is older — `nvm use 20` first if needed): `bunx playwright test e2e/analitica.spec.ts -g "@mssql"`
Expected: every test in the file PASSES — this is the cumulative regression check across every task in this plan (Tasks 5, 8, 12 each added/updated tests here).

- [ ] **Step 4: Run the rest of the E2E suite (everything else in `e2e/`) to confirm no cross-feature regression**

Run: `bun run e2e`
Expected: PASS — confirms Part 1's Cache-Control addition (Task 1) and the shared `jsonWithCache` helper didn't break any non-Analítica page that happens to also hit a `dwh/*` route, and that no other e2e spec was affected by any of this plan's changes.

- [ ] **Step 5: Type-check the whole project one final time**

Run: `bunx tsc --noEmit`
Expected: zero errors (or only the pre-existing, unrelated errors already documented as expected baseline noise in prior plans in this repo — e.g. `__tests__/integration/inventory-change-unit.integration.test.ts` — if any such baseline errors exist, confirm via `git stash` that they predate this plan's changes before treating them as acceptable).

- [ ] **Step 6: Live-verify Task 9's `DueDateKey` backfill against the real local DWH**

Run the incremental load and snapshot scripts against the local DWH (same scripts this project already uses for every prior "live-verified" investigation — see `docs/DATA_WAREHOUSE_GUIDE.md`'s repeated citations of `bun run dwh:incremental-load`/`bun run dwh:snapshot-load`):

```bash
bun run migrate:dwh
bun run dwh:incremental-load
bun run dwh:snapshot-load
```

Then, using the same `buildConfig(dwhDatabaseName())` connection pattern `scripts/migrate-dwh.ts` exports (reused by every DWH test file in this plan), run this query against the local DWH and record its actual output in this task's own execution notes (not committed to a script file — this is a one-off manual verification, matching the "Manually verify against the live local DWH" steps in Tasks 6/9/10):

```sql
SELECT
  COUNT(*) AS TotalRows,
  SUM(CASE WHEN DueDateKey IS NOT NULL THEN 1 ELSE 0 END) AS RowsWithDueDate,
  CAST(SUM(CASE WHEN DueDateKey IS NOT NULL THEN 1 ELSE 0 END) AS float) / NULLIF(COUNT(*), 0) AS ResolvedFraction
FROM fact.Fact_Collections
WHERE IsVoided = 0;
```

Expected: `ResolvedFraction` is a plausible, non-zero fraction (not 0.0 — a 0% resolution rate would indicate the join in Task 9's migration is broken, e.g. a collation or `RTRIM` mismatch that silently matches nothing). Record the actual numbers observed. If `ResolvedFraction` is 0, stop and debug the join in `dwh-migrations/0027_fact_collections_due_date.sql` (per `superpowers:systematic-debugging`) before proceeding — do not treat 0% as acceptable and move on.

- [ ] **Step 7: Live-verify Task 6's proxy waterfall math against the real local DWH**

Using the same connection pattern, run this query (mirroring `app/api/dwh/finanzas/route.ts`'s `salesNetQuery`/`returnsNetQuery`/`expenseCategoryQuery` over the widest practical window, e.g. `WHERE fs.DateKey >= 20200101` or whatever the local DWH's actual data range is — check via `SELECT MIN(DateKey), MAX(DateKey) FROM fact.Fact_Sales` first):

```sql
DECLARE @Ingresos decimal(18,2) = (
  SELECT ISNULL(SUM(fs.NetAmount), 0) FROM fact.Fact_Sales fs WHERE fs.IsVoided = 0
) - (
  SELECT ISNULL(SUM(fr.NetAmount), 0) FROM fact.Fact_Returns fr WHERE fr.IsVoided = 0
);
DECLARE @Compras decimal(18,2) = (
  SELECT ISNULL(SUM(v.Amount), 0) FROM dwh.vw_GastosOperativos v WHERE v.Category = 'Compras'
);
DECLARE @GastosOperativos decimal(18,2) = (
  SELECT ISNULL(SUM(v.Amount), 0) FROM dwh.vw_GastosOperativos v
);
SELECT
  @Ingresos AS Ingresos,
  @Compras AS Compras,
  @Ingresos - @Compras AS UtilidadBrutaProxy,
  CASE WHEN @Ingresos > 0 THEN (@Ingresos - @Compras) / @Ingresos ELSE NULL END AS MargenBrutoRate,
  @GastosOperativos AS GastosOperativos,
  @Ingresos - @GastosOperativos AS MargenOperativo,
  CASE WHEN @Ingresos > 0 THEN (@Ingresos - @GastosOperativos) / @Ingresos ELSE NULL END AS MargenOperativoRate;
```

Expected: `Ingresos` and `Compras` are both large positive numbers of a plausible relative magnitude (Compras noticeably smaller than Ingresos, not larger by an order of magnitude — a red flag if so), `UtilidadBrutaProxy` is positive (a business losing money on Compras alone relative to revenue would be a red flag worth double-checking, not necessarily wrong, but worth noting), and `MargenOperativo` here matches exactly what `GET /api/dwh/finanzas` returns as `cashFlowEbitda.ebitda` for the equivalent date range (spot-check by calling the route directly with the same window, e.g. `custom:2020-01-01:2026-12-31`, and comparing the two numbers to the cent). Record the actual numbers observed.

- [ ] **Step 8: Record the live-verification results**

Write a short paragraph (in this task's own execution notes, e.g. a PR description or commit message body — not a new committed doc file, matching this plan's "manual verification, not a committed test" convention already used in Tasks 6/9/10) stating: the `ResolvedFraction` observed in Step 6, the `Ingresos`/`Compras`/`UtilidadBrutaProxy`/`MargenOperativo` values observed in Step 7, and confirmation that Step 7's `MargenOperativo` matched the live route's `cashFlowEbitda.ebitda` for the same window. This mirrors the existing "Investigated live 2026-09-1X ... live-verified: ..." style already used throughout this codebase's migrations and DWH guide.

- [ ] **Step 9: Final commit (only if Steps 1-7 required any fix)**

If every step passed cleanly with no code changes needed, there is nothing to commit for this task — it is a verification-only gate. If any step surfaced a bug that required a fix, commit that fix with a message describing what Step caught it:

```bash
git add -A
git commit -m "fix: <describe what the live-verification pass in Task 16 caught>"
```
