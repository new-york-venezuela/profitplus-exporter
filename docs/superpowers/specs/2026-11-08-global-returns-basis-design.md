# Global returns basis (devolución date by default)

Status: draft for approval. Date: 2026-11-08.

## Intent and why

Resumen counts returns by the date of the factura they came from
(`ReturnsBasis = 'factura'`), so a return registered this month for an older
factura never shows up in this month. The user wants to see the effect returns
have *in their own time*. Today the only way to change the basis is a local
toggle on the Ventas tab.

Two changes:

1. A **global returns-basis selector** in Analítica, next to the date range,
   kept in the URL like `dateRange`. Default is **por fecha de devolución**
   (`devolucion`). The other value is **por fecha de factura** (`factura`).
2. Every tab that has no selector now counts returns **by devolución date,
   always**. This changes their existing netas / devoluciones figures.

## Goals

- One URL param, `returnsBasis=devolucion|factura`, owned by
  `analitica-client.tsx` and passed to tabs like `dateRange`. Absent or invalid
  means `devolucion`.
- The selector is visible only on **Resumen, Ventas, Devoluciones**; it is
  hidden on every other tab. The param is ignored (not forwarded) on hidden-tab
  requests, so a stale `?returnsBasis=factura` never affects Seguimiento etc.
- Ventas drops its local `returnsBasis` state and toggle and reads the global value.
- Resumen and Devoluciones read the global value (their APIs gain the param).
- Resumen cards/chart state the basis in use, the way Ventas does today
  (`RETURNS_BASIS_LABEL`).
- Seguimiento, Clientes, Productos, Finanzas, Histórico 2025 and Vendedor 360
  window returns by `fr.DateKey` (devolución date) unconditionally.
- Default of `parseReturnsBasis` and `buildReturnsDateWhereClause` becomes
  `devolucion`; the explicit `'factura'` arguments in the non-selector routes
  go away.

## Non-goals

- No selector on tabs other than the three above.
- No change to how USD is converted (see Constraints).
- No new DWH migration; both date columns already exist on `Fact_Returns` and
  `Fact_Returns_Legacy`.
- Gross sales (brutas) are untouched.

## Anti-goals

- A returns figure that silently differs between two places on the same tab
  (e.g. the Resumen cards on one basis and its chart on another).
- Hidden-tab requests accidentally honouring the URL param.
- `null` USD turning into `0` anywhere the queries are touched (existing invariant).

## Constraints

- **USD stays at the original factura's rate** (`returnsUsdConversionJoin`
  uses `OriginalInvoiceDateKey`) whatever basis windows the row. A return line
  is priced at the factura's price in Bs, so converting at the devolución date
  would understate USD. Do not change this.
- Under `devolucion`, `ventas netas = brutas − devoluciones` is still the
  arithmetic, but it no longer reconciles per factura. The `factura` basis
  remains available on the three selector tabs for that reconciliation.
- Anything that buckets returns by period (months, ISO weeks, trend charts)
  must bucket by the same date column that windows them. Today several joins
  hard-code `OriginalInvoiceDateKey` for the bucket (e.g.
  `lib/seguimiento/queries.ts`, the Resumen trend query) and must follow.
- Histórico 2025 is calendar 2025 only; its return window becomes
  `frl.DateKey` (`lib/dwh/historico-window.ts`). A return dated in 2026 for a
  2025 factura leaves the 2025 window; one dated in 2025 for a 2024 factura
  enters it. That is the intended effect.
- Dev guidance in AGENTS.md ("Ventas brutas / netas") and
  `content/help/analitica-definiciones.md`, `docs/ventas-netas-analysis.md`
  describe the factura rule; update them in the same change.

## What is left to the builder

- Where exactly the selector sits in the toolbar and its look; follow the
  existing range/currency controls and keep it accessible (text label,
  `aria-pressed` or a `<select>`, not colour alone).
- The exact wording of the basis label on Resumen cards (reuse
  `RETURNS_BASIS_LABEL`).
- Refactoring the shared query helpers so the bucket column and the filter
  column cannot diverge (e.g. pass the basis down and derive both from
  `returnsDateColumn`).
- Updating the existing tests whose expected SQL or figures encode the
  factura basis, and adding tests: parse default, hidden-tab param ignored,
  one route per basis.

## Calls made without the user (to check)

1. Param name and values: `returnsBasis=devolucion|factura`, matching the
   existing `ReturnsBasis` type and Ventas API param.
2. Selector as a UI control placed beside the date range; it keeps the
   Ventas toggle's wording.
3. USD conversion stays at the factura rate (see Constraints).
4. Hidden tabs ignore the URL param.
5. Devoluciones' rate denominators (sales in the same window) follow the
   selected basis; under `factura` they match the invoices the returns came from.
