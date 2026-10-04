# Clientes: cobertura de ventas (customers never / no longer sold to)

Sub-project 1 of 5 in the `/analitica` improvements (order: Clientes, Resumen+Vendedores, Ventas, Devoluciones, CxC).

## Goal

In the Clientes tab, show every customer in the DWH with when we last sold to them, their
average monthly volume (USD and units) and their default seller, make "never sold" explicit,
and let users print the list by seller and export it to Excel.

## Decisions (agreed with the user)

- **Grain:** one row per customer code (store), current SCD2 version only (`Dim_Customer.IsCurrent = 1`).
  Name, seller and attributes come from the current version. Volume is aggregated across **all**
  versions of the same `CustomerCode`, since `Fact_Sales.CustomerKey` points at the version
  that was current when the invoice was loaded.
- **Inactive customers** (`IsInactive = 1`) are excluded by default; a toggle includes them.
- **Not time sensitive:** the section ignores the page date-range selector and says so on screen.
  Last sale looks at all history.
- **Cutoff:** a customer is "lapsed" when the last sale is more than 30 days before today (named constant).
- **Monthly average:** trailing 12 months window (last 12 complete calendar months plus the current month
  to date). `avgMonthly = sum over window / number of distinct months with at least one
  invoice in the window`. Jan+Mar+Apr buyer divides by 3. USD and units both follow this rule. No invoices
  in the window gives "Sin datos" (not 0). Documented in `content/help/analitica-definiciones.md`.
- **Never sold vs matrix:** a store with no invoices of its own is flagged `never` only if its parent
  matrix (legal entity) also has no sales. If the matrix does have sales, the store gets status
  `via_matriz` ("Vende vía matriz") and shows the matrix's last sale date, labelled as such.
  Assumption to confirm during review: `via_matriz` stores are not counted as "never sold" in the summary boxes.
- **Statuses:** `never` (no invoice for store nor matrix), `via_matriz`, `lapsed` (>30 days), `active`.
- **Missing data** always reads "Sin datos". Sort by "Días sin vender" ascending: no data first,
  then the longest gap, down to the most recent. Descending is the exact reverse.

## Architecture

- New route `app/api/dwh/clientes/cobertura/route.ts`, `GET`, gated by `hasDwhAccess` (401/403 JSON `{ error }`).
  DWH only (`getDwhPool()`), `.input()` for the `includeInactive` flag. Never touches ERP tables.
- Pure helper `lib/dwh/cobertura.ts` (or next to the tab's `lib/`): status classification, days-since,
  sort comparator (null-first), average computation from per-month aggregates. Unit tested.
- SQL: CTE of current customers, CTE of all-version sales per `CustomerCode` (`MAX(date)`, per-month USD and
  units for the trailing window using the invoice-rate USD conversion already used by the Clientes route),
  CTE of the same at legal-entity level for the matrix check, joined to `Dim_SalesRep` for the seller name.
- UI: new "Cobertura de clientes" section at the top of `tabs/tab-clientes.tsx` (extract to its own
  component file if the tab file grows unwieldy). Four summary boxes (never, lapsed, active, via matriz), a
  table (Cliente, Entidad, Vendedor, Última venta, Días sin vender, USD/mes, Unidades/mes, Estado),
  filters: seller (`SearchableSelect`), status, include-inactive.
- Print: `Imprimir` calls `window.print()`; print CSS hides nav/filters and prints a seller header; with
  all sellers selected each seller block starts on a new page.
- Excel: `Exportar Excel` exports the current filtered rows via `lib/xlsx.ts`.
- PostHog: `posthog.capture` for print and export (client-only signals).

## Testing

- Unit: classification, null-first sort, divisor rule (Jan/Mar/Apr = 3), no-window-sales gives no data.
- DWH integration (`scripts/dwh/` pattern, disposable DB): never-sold store, never-sold store with selling
  matrix, lapsed, active, customer with two SCD2 versions and sales on the old version, inactive customer.

## Open item to verify while implementing

Confirm how the store-to-matrix link is stored (`LegalEntityKey` on `Dim_Customer`, per
`Dim_LegalEntity`) and that migrations 0028/0030 leave it reliable for every current customer.
