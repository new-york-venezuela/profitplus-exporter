# Reportes de CxC: Comprobantes de Retenciones y Facturas pendientes por cobrar

Date: 2026-11-15. Size: small change (two read-only reports on the existing reports pipeline).

## Intent

Credit and Collections asked for two raw-data exports from the internal exporter, over open receivables
(`saDocumentoVenta`, `saldo <> 0`, not `anulado`):

1. **Comprobantes de Retenciones** - open FACT / N/CR / N/DB of special-contributor customers (`saCliente.contrib = 1`),
   so the team can request missing IVA retention vouchers and track retentions pending recovery/reconciliation.
2. **Facturas pendientes por cobrar** - open invoices with the structure Credit and Collections use for follow-up.

Why: find the documents quickly, ask customers for vouchers on time, control IVA retention still to recover, and
determine tax obligations correctly.

## Goals

- Two new entries in the reports registry, available to every authenticated user like Ventas/Compras (no module gate).
- Same UX and export route as today: columns picker, xlsx/csv, `report_exported` PostHog event.
- Customer type is read live from the customer group (`saCliente.co_seg` -> `saSegmento`), so it can hold more than
  cadena/independiente. Seller from `saVendedor` via the customer's current `co_ven` (to confirm in the plan against the
  document's own `co_ven`).

## Non-goals / anti-goals

- No writes to the ERP, no new SQLite/DWH tables, no stored procedures.
- Not a change to the existing Libro de Ventas (`RepLibroVenta`); it stays as is.
- Must not silently show `0` for a missing figure (same discipline as the rest of the app): unknown base/exempt = blank
  and mentioned in the plan's open points, not `0`.

## Approaches

- **A. Inline read-only SQL in the app (chosen).** New `queryType: 'query'` in `ReportConfig`; each report ships its SQL and a
  pure row mapper. Reuses export route, builders and column picker. No ERP install step.
- B. New ERP stored procedure (like `RepLibroVenta`): needs an install on the ERP and repo keeps procs for writes. Rejected.
- C. DWH: no retention detail and not live. Rejected.

## Design

### Shared
- `lib/reports/registry.ts`: `queryType` gains `'query'`; `REPORTS` gets `retenciones` and `cxc-pendientes`.
  The export route dispatches by report id to a query function (`lib/reports/queries/*.ts`) and a mapper, as it already
  does for compras/ventas. Queries use `.input()` for every user value and `trimStrings` on results.
- As-of-today snapshot, no date range. Optional filter on issue date (`startDate`/`endDate` honoured when present).
- Pages `app/(app)/reports/<id>/page.tsx` copied from ventas (no date range picker required; keep the picker for the
  optional issue-date filter) and nav links in `components/sidebar.tsx`.

### Comprobantes de Retenciones (`retenciones`)
- Rows: open documents (FACT, N/CR, N/DB) where `saCliente.contrib = 1`. Fully processed documents (`saldo = 0`) are
  excluded: the retention is registered and the document is paid.
- Columns: Vendedor, Tipo de cliente, Cliente, Tipo doc, Nº documento, Fecha de emisión, IVA total,
  75 % del IVA (retención por conciliar), Saldo pendiente.
- 75 % = `IVA total x 0.75`, a plain calculation. Customers that withhold 100 % are not distinguished (documented limitation).
- N/CR rows are shown with their own sign convention from `lib/statements/build-statement.ts` semantics only if the
  plan finds that mixing signs in one sheet is confusing; otherwise raw positive values plus the tipo doc column.

### Facturas pendientes por cobrar (`cxc-pendientes`)
- Rows: open FACT only.
- Columns: Vendedor, Tipo de cliente, Cliente, Nº factura, Fecha de emisión, Fecha de vencimiento, Días de crédito
  (`fec_venc - fec_emis`), Base imponible, Monto exento, IVA.
- Base imponible / exento / IVA are computed from the invoice's **lines** (`saFacturaVentaReng`, join `doc_num = saDocumentoVenta.nro_doc`),
  grouped by `tipo_imp`: lines taxed at an IVA rate add to base and IVA (`monto_imp`), lines with the exempt code (`E`, per the KB; verify live)
  add to exempt. Header-level global discount/surcharge (`monto_desc_glob`/`monto_reca_glob`, prorated per line in the Reng tables)
  must be handled so base + exempt + IVA reconciles with the document total; the plan's first task checks this against
  `saDocumentoVenta.total_neto` and `RepLibroVenta` for a sample of open invoices.

## Research notes (from the Profit Plus knowledge base; live ERP was unreachable, `servidor01:1435` timed out)

| Document | Line table | Notes |
|---|---|---|
| FACT | `saFacturaVentaReng` (`tipo_imp`, `porc_imp`, `monto_imp`, `reng_neto`) | confirmed by the user and the KB |
| N/CR | `saDocumentoVentaReng` (same tax columns; KB: 214 rows, 100 % N/CR) | return credit notes also exist as `saDevolucionCliente`/`...Reng` headers; the ledger row is `saDocumentoVenta` |
| N/DB | no line table known | KB: ledger row only (often FX-difference debit notes); IVA only from `saDocumentoVenta.monto_imp`, no base/exempt |

- **Retenciones** needs only IVA total, which every ledger row already has (`saDocumentoVenta.monto_imp`), so it does **not**
  depend on line tables. The Reng research only affects the second report (FACT only).
- Retention state: IVA retention is recorded per collection line (`saCobroDocReng.monto_retencion_iva` +
  `saCobroRetenIvaReng`). A document with a registered retention and `saldo = 0` is out; the report is driven by `saldo <> 0`.
- Seller: document's own `co_ven`, falling back to the customer's `co_ven` when blank (user decision).
- **Unverified until the ERP is reachable** (first plan task, read-only probe): tax codes in `tipo_imp` (exempt code),
  whether open N/DB rows exist and carry lines, and how many open documents have a blank `co_ven`.

## Tests

- Pure mappers: unit tests (75 % maths, credit days, blank vs zero, type/seller trimming).
- Query functions: tested with a mocked pool like `compras-query.ts`; one optional integration check against the ERP
  (read-only) listed with the other `test:mssql` tests.
- Route: dispatch for the two new ids, 401 when no session, column resolution.

## Left to the builder

- Exact SQL joins and the source of base/exempt (see above); column labels (Spanish) and order within the lists above.
- Whether the date filter is exposed in the UI or API only.
