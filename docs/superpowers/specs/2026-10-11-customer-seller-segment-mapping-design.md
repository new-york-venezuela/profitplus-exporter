# Customer seller / group mapping fix (ERP + DWH restate)

Date: 2026-10-11
Status: design approved in chat, pending written-spec review

## Problem

`2026-bbdd-profit.xlsx` (sheets `Maestro Clientes`, `Ventas Diarias (Profit)`)
defines a corrected customer → seller assignment and a new customer
classification (`Grupo de Cliente`, `Tipo cliente` Cadena/Independiente,
`Nombre Cliente Principal`). The ERP and DWH currently carry the wrong
sellers for some customers (data-quality issue) and have no such
classification. The correction applies from **2026-03-01**.

## Findings about the workbook

- `Maestro Clientes`: 174 rows; group (12 values), type (2) and parent (80) are
  complete. `Nombre Vendedor` and `Ruta` are empty. One duplicated code
  (`J317277619`) and 2 rows without a code.
- `Ventas Diarias`: 4,841 invoice lines, 133 customers, seller codes
  5, 6, 7, 15, 17, 39, 40, 41 (names blank). 11 customers have >1 seller.
  Dates are mixed text / datetime values and need normalising.
- Customer codes appear in differing dash forms (`J-30142-20` vs `J30142`).

## Decisions

| Topic | Decision |
|---|---|
| Seller source | Seller on each customer's **latest** invoice line in the workbook |
| Fix target | ERP **and** DWH restate |
| Invoice history | Rewrite ERP invoice sellers (`saFacturaVenta.co_ven`) for `fec_emis >= 2026-03-01` |
| Group storage | `saCliente.co_seg` (`saSegmento`) in the ERP; type + parent in a DWH mapping table. `tip_cli` is NOT touched (pricing depends on it) |
| Review UX | CSV in the repo, validated and diffed by a command |

## Design

### 1. Mapping file and generator
- `data/customer-mapping/2026-03.csv`: `co_cli, nombre, co_ven, grupo, tipo_cliente, cliente_principal, effective_from, source_note`.
- `bun run mapping:build -- <xlsx>` generates the CSV and `mapping-conflicts.csv`
  (multi-seller customers, duplicate code, missing codes, codes absent from the ERP).
  Conflicts are resolved by hand-editing the CSV.
- Customer codes are matched after trimming and normalising dashes. Unmatched
  codes block the apply step.

### 2. Apply command — `bun run mapping:apply`
- Dry-run by default: prints customers changed, invoices changed (count, USD),
  DWH rows affected. `--apply` required to write.
- Before-snapshot of every touched row stored in `mapping_apply_log` (run id);
  `--rollback <run>` restores it.
- `migrations/mssql/0016`: `pApiActualizarSegmentoCliente` (writes `co_seg`,
  resolving/creating the `saSegmento` row) and `pApiCorregirVendedorFactura`
  (updates `co_ven` for `fec_emis >= 2026-03-01`, refuses annulled documents).
  Returns / collections seller columns are verified against the ERP schema and
  handled the same way if they exist. Seller changes on customers reuse
  `pApiActualizarVendedorCliente`. No raw UPDATEs.
- Requires an explicit flag acknowledging the target database. First run is to
  be done on a non-production copy (documented in `INSTRUCTIONS.md`).

### 3. DWH restate
- `migrations/dwh/0039`: `dim.Dim_CustomerMapping` (type, parent, group,
  `effective_from`) joined into `Dim_Customer`; idempotent per
  `migrations/dwh/README.md`.
- `Fact_Sales` takes its seller from the invoice header, so after the ERP fix
  the command resets the `saFacturaVenta` watermark to 2026-03-01 and runs the
  `Load_*` procedures. `Dim_Customer` SCD2 history is closed/reopened at 2026-03-01.
- Dashboard filters for type/parent are out of scope.

### 4. Testing
- Unit: code normaliser, latest-seller picker, conflict detection, diff
  computation (pure functions).
- DWH integration on a disposable database (`scripts/dwh/`).
- ERP-writing tests join the non-production-only group (like `test:pricing-erp`).

## Risks / open items
- Rewriting posted invoice sellers changes historical commission and sales
  reports inside Profit Plus.
- Workbook sellers cover only Sep–Oct 2026 but are applied from March. A
  customer who changed seller in between receives the latest seller for the whole
  range. If wrong, the CSV needs a per-period seller column.
- Assumption to verify: workbook seller codes equal `saVendedor.co_ven`.
