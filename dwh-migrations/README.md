# DWH Migrations — DWH_AlimentosNY

Numbered `.sql` files applied in order by `scripts/migrate-dwh.ts` (`bun run migrate:dwh`), tracked in `dwh.__dwh_migrations`.

## Running

    bun run migrate:dwh

Reads `DW_SERVER`/`DW_PORT`/`DW_NAME`/`DW_USER`/`DW_PASSWORD`/`DW_ENCRYPT`/`DW_TRUST_SERVER_CERT` from the environment, falling back to the corresponding `DB_*` value (same instance, different database) when a `DW_*` var is unset. `DW_NAME` defaults to `DWH_AlimentosNY` if neither is set.

The runner connects to `master` first to create the database if it doesn't exist yet, then reconnects to the DWH database for every subsequent migration.

## Layout

- `dwh` schema — control tables (`EtlWatermark`, `__dwh_migrations`) and every `Load_*`/`Snapshot_*` stored procedure
- `dim` schema — dimension tables
- `fact` schema — fact tables

## Adding a new migration

1. Create the next-numbered `.sql` file (e.g. `NNNN_...sql`, one higher than the current highest file in this directory)
2. Wrap `CREATE TABLE`/`CREATE PROCEDURE` in existence checks (`IF NOT EXISTS` / `CREATE OR ALTER`) so re-running is always safe
3. Separate multi-batch DDL (anything needing more than one `CREATE`/`ALTER` in sequence) with a line containing only `GO`
4. Run `bun run migrate:dwh` locally against a test database before committing

## Margin/cost data — recipe-based, partial coverage (resolved 2026-09-20)

`Fact_Sales.UnitCost`/`COGSAmount`/`GrossProfitAmount`/`CostSourceFlag` are wired up, sourced from `stg.RecipeCostSnapshot` (`0031_stg_recipe_cost_snapshot.sql`) — timestamped cost snapshots computed by `scripts/dwh-recipe-cost-load.ts` from the exporter app's own Recipes module (SQLite `recipes`/`recipe_lines` + a live FIFO walk over `Ncake_a.dbo.saCostoHistoricoEntrada`, `lib/costing/*.ts`). `dwh.Load_Fact_Sales` (`0032_fact_sales_recipe_cost.sql`) joins each sale to the *latest* snapshot for that product; `dwh.Backfill_Fact_Sales_RecipeCost` (same migration, called by the same loader) keeps already-loaded historical rows in sync, since the watermark-gated MERGE never revisits unchanged ERP rows on its own.

This is the DWH's only non-T-SQL data source — see `0031`'s header comment for why (SQL Server can't query the app's SQLite file the way it cross-database-queries `Ncake_a`, and the FIFO walk itself runs in TypeScript). Run it via `bun run dwh:recipe-cost-load`, or let `dwh:incremental-load` run it automatically (it does, before the `EXEC` batch).

**Coverage is partial by nature, not a bug**: only products with an active recipe get real cost data (`CostSourceFlag` is `'RECIPE_FIFO'`/`'RECIPE_ESTIMATED'`); everything else stays `'NO_COST_DATA'`, same as before. Cost is now genuinely point-in-time, not a current-cost proxy: `dwh.fn_IngredientCostAsOf` reconstructs each raw material's remaining FIFO layers as of the sale's own date (from `saCostoHistoricoSalida`'s per-event timestamps), so two sales of the same product on different dates correctly get different costs when the ingredient's price changed in between. `stg.RecipeLine` mirrors each recipe's ingredient list into the DWH so this can run as one set-based T-SQL query per (product, date) pair instead of a per-sale round trip. The one remaining simplification: no recipe versioning exists, so this is "what today's recipe would have cost on that date," not "what the recipe as it was defined back then would have cost."

## Incremental watermark strategy

`saFacturaVentaReng`, `saDevolucionClienteReng`, and `saCobroDocReng` — the three "Reng" line/detail
tables feeding `Fact_Sales`, `Fact_Returns`, and `Fact_Collections` respectively — have **no
`validador` rowversion column**, unlike their header tables. They only carry an app-layer
`fe_us_mo` datetime column, which is not guaranteed monotonic or gap-free the way a rowversion is.

Because of this, `dwh.EtlWatermark` has **two** watermark columns, not one:

- `LastValidador` (`binary(8)` rowversion) — used by header/master tables that have a real
  `validador` column (e.g. `saFacturaVenta`, `saDevolucionCliente`, `saCobro`).
- `LastValidatorDateTime` (`datetime2(3)`) — used by the three `*Reng` detail tables above, keyed
  off `fe_us_mo`.

Each of the three fact-loading procedures therefore tracks its header and detail source tables as
**two separate rows** in `EtlWatermark` — e.g. `Load_Fact_Sales` maintains one watermark row for
`'saFacturaVenta'` (using `LastValidador`) and a second for `'saFacturaVentaReng'` (using
`LastValidatorDateTime`). Do not assume a single watermark row/column per fact table.

If you add another fact table sourced from a similarly-shaped detail table, check whether that
table has a real `validador` column before assuming it does — if it doesn't, follow this same
two-column, two-row pattern rather than trying to force a rowversion watermark onto a table that
doesn't have one.

## SCD2 vs. structural/relational columns on Dim_Customer

`Load_Dim_Customer` is SCD2 (Type 2): any tracked attribute change closes out
the current row and inserts a new one with a new `CustomerKey`. That's
correct for descriptive attributes (`CustomerName`, `CreditLimit`, etc.), but
it is **wrong** for a column another dimension's identity depends on, like
`MatrizCode` (which `Dim_LegalEntity`/`LegalEntityKey` resolves against).
0030 fixed a real production bug from this: setting `saCliente.matriz` on an
existing customer minted a new `CustomerKey`, and since
`Load_Dim_LegalEntity`'s own resolution only ever touches `IsCurrent = 1`
rows, the closed-out row's `LegalEntityKey` stayed `NULL` forever — every
fact row still pointing at that old key then silently dropped out of every
`cliente_entidad`-grouped report.

`MatrizCode` is therefore intentionally excluded from `Load_Dim_Customer`'s
SCD2 diff and instead kept in sync with an unconditional in-place `UPDATE`
inside that same procedure (see `0030_fix_matriz_scd2_and_repair_split_customers.sql`).
If you add another column to `Dim_Customer` (or any other SCD2 dimension)
that a different dimension/rollup resolves its own identity against, follow
this same pattern — update in place, don't version — rather than defaulting
to the existing SCD2 diff shape.

## Performance note

All timing/performance data referenced in this plan and its task reports (load procedure runtimes,
test suite duration, etc.) was collected against this environment's live test database, whose row
volumes are far smaller than the original design spec's estimates. For example, the design spec
estimated ~3.4M rows for `saFacturaVentaReng`; live testing found only ~4,710 rows (with
`saFacturaVenta` at 1,906, `saDocumentoVenta` at 2,958, and `saDevolucionClienteReng`/
`saDevolucionCliente` and `saCobroDocReng`/`saCobro` at comparably small scale).

None of the observed timings in this plan are a reliable proxy for production-scale load times.
Anyone tuning indexes, sizing the incremental load window, or setting SQL Agent schedule intervals
based on this plan's observed test timing should re-verify against real production volume first.

## Enabling the SQL Agent jobs

`DWH - Incremental Load` and `DWH - Daily AR Snapshot` (from `0013_sql_agent_jobs.sql`) are created **disabled**. Load frequency is an open business decision (spec §5.1) — pick a schedule, then:

```sql
EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Incremental Load', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Incremental Load', @name = N'Every 30 min', @freq_type = 4, @freq_interval = 1, @freq_subday_type = 4, @freq_subday_interval = 30;

EXEC msdb.dbo.sp_update_job @job_name = N'DWH - Daily AR Snapshot', @enabled = 1;
EXEC msdb.dbo.sp_add_jobschedule @job_name = N'DWH - Daily AR Snapshot', @name = N'Daily after close', @freq_type = 4, @freq_interval = 1, @freq_subday_type = 1, @active_start_time = 220000;
```
