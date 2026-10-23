# Customer credit terms repair

Date: 2026-10-22
Status: Implemented (mock verified; production dry-run pending)

## Why

The CxC module (Analítica > CXC y Cobranzas) computes aging and "% vencido" from
`saDocumentoVenta.fec_venc`. In production most customers are configured as
Contado (`saCliente.cond_pag = '000001'`) although Ops bills them on credit
(7/21/35 days), so their invoices carry `fec_venc = fec_emis` and show as overdue
the day after billing. The 2026-09-19 spec concluded the remaining Contado balance
was genuine; Ops' validated report ("dias creditos.xlsm") shows it is not. Credit
days have not changed since the beginning, so the fix applies to every unpaid
invoice, not just recent ones.

Measured on the mock (a recent prod backup): 519 open FACT invoices, 388 with
`fec_venc = fec_emis`. Of 136 name-matched customers, 108 have a `cond_pag`/
`plaz_pag` that disagrees with Ops.

## Goals

1. Set the correct credit term on each customer in `saCliente` (`cond_pag` + `plaz_pag`).
2. Recompute the due date of every **unpaid** FACT invoice of those customers from
   the term: `fec_venc = fec_emis + dias_cred`.
3. Reversible (audit + rollback), dry-run by default, safe to re-run.
4. Leave CxC metrics correct after a DWH snapshot reload.

## Non-goals / anti-goals

- Paid, voided (`anulado`) or zero-balance (`saldo = 0`) invoices are never touched.
- Credit notes (`N/CR`), `ADEL` and other document types are never touched.
- No change to the aging or "vencido" definitions (no grace period).
- No raw writes to ERP tables: everything goes through new `pApi*` procs.
- Anti-goal: silently guessing. Any customer whose term is not backed by Ops data
  or an explicit decision below is left alone and reported.

## Source of truth

`data/credit-terms/2026-10.csv`, committed, columns
`co_cli, name, dias_cred, source, note`. `source` is one of:
`exact` (Ops name equals prod name after normalisation), `fuzzy` (confirmed name
match), `inherited` (store takes its parent's term via `saCliente.matriz`),
`override` (explicit decision, wins over Ops), `skip` (listed, not applied).

The CSV is generated once by a throwaway script from two inputs: Ops'
"dias creditos.xlsm" (sheet CUENTAS POR COBRAR, cols A-D, one row per invoice) and
the prod `saCliente` export (`clientes.csv`, 188 customers, semicolon separated,
no header, column order = `saCliente` ordinal positions). The apply script never
reads the Excel; it reads the committed CSV and validates every `co_cli` against
the live database.

### Resolution rules

1. Normalise names (ASCII fold, upper case, strip punctuation and `C.A.`/`S.A.`)
   and match Ops names to prod customers. Prod export is the reference, not the mock.
2. When Ops has several values for one customer, use the majority, except the
   decisions below.
3. A store with no explicit Ops row inherits its parent (`matriz`) term when the
   parent is in Ops. An explicit store row wins over the parent.
4. Overrides and the confirmed decisions below are written as `override`/`fuzzy`.

### Decisions confirmed in conversation

| Customer | `co_cli` | Days | Basis |
|---|---|---|---|
| Unicasa (parent + stores `-1`..`-9`) | `J001675523`, `J001675523-1..9` | 15 | override: Ops says 21, user says all Unicasa invoices are 15; already the ERP value, so no write |
| Farmacia Farma Servicios La Candelaria | `J-504108979` | 7 | same as the other Farma Servicios branches (Florida, Ruices, Castellana are 7) |
| Farmacia Farma Servicios La Florida | `J502434526` | 7 | Ops split 5x21/4x7; user confirmed 7 |
| Automercado El Venado | `J000689253` | 7 | Ops name "El Venado"; already 7 |
| Kalea La Trinidad (Comercializadora Global C y D) | by name | 21 | user decision (Ops majority was 7) |
| Hipermercado Páramo (all, incl. Palo Verde) | parent `J503848049` + children | 7 | user decision |
| Farmacia SAFEL 777 La Castellana | `J-30603501-0` | 21 | Ops majority |
| Supermercado Rio Vida | parent `J500585039` + children | 35 | Ops majority |
| Grupo BGM24 | none in prod | - | `skip`, not found |

Fuzzy matches proposed (not yet confirmed by name, listed in the CSV for review):
Siempre Fresco -> `J002497297` (7), Bistro 031 -> `J412473875` (7),
Inversiones Soleil -> `J300055272` (7), Farmacia Daranpe -> `J306811036-1`,`-2` (21).

Inversiones Cold 2024 (parent `J505366220` + its stores, currently 15 days) is not in
Ops; user decision: 7 days (`override`).

## What gets written

### Migration `migrations/mssql/0019_*.sql` (re-runnable)

- Insert `saCondicionPago` row for 35 days (`Credito 35 dias`, next free `co_cond`;
  the table has no 35-day term today). Done through the same migration, guarded by `NOT EXISTS`.
- `pApiActualizarCondicionPagoCliente(@co_cli, @co_cond, @plaz_pag, @co_us_mo)`:
  rejects unknown customers and unknown terms, stamps `co_us_mo`/`fe_us_mo`, logs
  old and new values to `dbo.__exporter_credit_term_customer_fixes`.
- `pApiCorregirVencimientoFacturasCliente(@co_cli, @run_id, @co_us_in)`: for FACT,
  not voided, `saldo <> 0` invoices of the customer, set
  `saDocumentoVenta.fec_venc`, `saFacturaVenta.fec_venc` (same invoice) to
  `fec_emis + dias_cred`, and `saFacturaVenta.co_cond` to the customer's term
  (confirmed by user); log old/new per invoice to
  `dbo.__exporter_credit_term_invoice_fixes`. Atomic per customer (transaction).
  Supersedes nothing: the 0007 proc stays for single-customer, date-ranged use.
- Rollback restores from the two audit tables by `run_id`; refuses a row that
  changed since the fix (current value != logged new value).

### Script `scripts/credit-terms-apply.ts` (`bun run credit-terms:apply`)

Follows `scripts/mapping-apply.ts` conventions (`parseArgs`, `--confirm-db`):

- Default dry-run: per customer, current vs target term; counts and a CSV of the
  invoices that would change (old/new `fec_venc`, `saldo`).
- `--apply --confirm-db <DB_NAME>`: refuses unless `DB_NAME` matches; refuses while
  any CSV row is `review`/invalid, or any `co_cli` is missing or inactive in the DB.
- `--rollback <runId> --confirm-db <DB_NAME>`.
- Prints the follow-up: run `bun run scripts/dwh-snapshot-load.ts` (CxC reads the DWH snapshot).
- Pure planning (`lib/credit-terms/`: CSV reader, plan builder, name normalisation)
  separated from the ERP gateway, unit tested; the ERP-writing test is non-production-only
  like `test:mapping-erp`.

## Calls I made (please check)

1. (Confirmed by user.) Update `saFacturaVenta.fec_venc` and `co_cond` alongside `saDocumentoVenta.fec_venc`.
   The 0007 proc only touched `saDocumentoVenta`, but the two tables hold the same
   due date and the invoice-level condition would otherwise contradict it.
2. Customers already correct are not written. Invoices of those customers are still
   recomputed if their `fec_venc` disagrees with the term.
3. Inactive customers: none exist in the prod export; the script treats one as an error.
4. Four customers exist in prod but not in the mock (`J411057444`, `J502346473`, `J5055663682`,
   `J508477782`). Ops lists `J502346473` (Santorini Express) and `J5055663682` (Automercado Avila) at 7 days,
   so they are `exact`/7 (already on 7 days: only their invoices are recomputed); the other two are `skip`.
   Because the mock lacks them, the first write for these two happens in production: review them in the prod dry-run.

## Testing and rollout

- Run against the mock first (dry-run, then apply, then rollback, then verify counts
  return to the original). Only then against production with `--confirm-db`.
- Verify afterwards: open FACT invoices with `fec_venc = fec_emis` only for
  customers that are really Contado; CxC "% vencido" before/after after a snapshot reload.
- The mock lacks the 4 newest prod customers and recent invoices, so a prod dry-run
  report is required before applying.
