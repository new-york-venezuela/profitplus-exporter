# Compras — Fact_Purchases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Compras tab (currently a stub) real purchasing/supplier visibility, mirroring the existing Ventas tab's structure and the `Fact_Sales` ETL pattern almost exactly.

**Architecture:** New `dim.Dim_Supplier` (Type 1, sourced from `saProveedor` — mirrors `Dim_SalesRep`'s simpler pattern, not `Dim_Customer`'s SCD Type 2, since suppliers don't need point-in-time history for this use case) + new `fact.Fact_Purchases` (header+lines, mirrors `Fact_Sales`'s MERGE/watermark pattern exactly, sourced from `saFacturaCompra`/`saFacturaCompraReng`). New `app/api/dwh/compras/route.ts` and `tab-compras.tsx`, structured identically to Ventas.

**Tech Stack:** SQL Server (T-SQL migrations under `dwh-migrations/`), Next.js API routes, React, the existing shared `GroupedDrilldownTable` component and `query-builder.ts` generic `Dimension` model.

**Spec:** `docs/superpowers/specs/2026-09-12-finanzas-compras-design.md` (§2)

## Global Constraints

- Never edit an existing numbered migration file — every change is a new file (`dwh-migrations/README.md` convention).
- Every migration must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER`).
- No query ships without being run live against the real dev DWH connection first (`.env.local`).
- Currency-aware UI values must use the existing `moneyLabel`/`formatBreakdownMetric` pattern from the first render, not bolted on after.
- Cross-database joins (`Ncake_a.dbo.*` to `dim.*`/`fact.*` in `DWH_AlimentosNY`) always need `COLLATE SQL_Latin1_General_CP1_CI_AS` on the comparison and `RTRIM()` on fixed-width `char` columns on both sides — matches every existing `Fact_Sales`/`Dim_Customer` join.
- This plan is independent of `docs/superpowers/plans/2026-09-12-finanzas-fact-expenses.md` — no shared tables, no task ordering dependency between the two. They may be executed in either order or in parallel.

---

## Task 1: `Dim_Supplier` dimension

**Files:**
- Create: `dwh-migrations/0020_dim_supplier.sql`

**Interfaces:**
- Produces: `dim.Dim_Supplier` table (`SupplierKey`, `SupplierCode`, `SupplierName`, `ZoneCode`, `SegmentCode`, `SupplierTypeCode`, `IsInactive`, `LoadedAtUtc`) and `dwh.Load_Dim_Supplier` procedure. Task 2 (`Fact_Purchases`) joins on `SupplierKey`.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0020_dim_supplier.sql`:

```sql
-- Type 1 (overwrite) dimension, following Dim_SalesRep's pattern
-- (dwh-migrations/0007_dim_salesrep_warehouse_documenttype.sql) rather than
-- Dim_Customer's SCD Type 2 pattern — suppliers are used here purely for
-- "top supplier by spend" rollups (same shape as Vendedores' "top rep by
-- sales"), which has no point-in-time-history requirement. Revisit if a
-- future need for historical supplier attribute tracking emerges.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Supplier' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Supplier (
        SupplierKey       int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SupplierCode      char(16)      NOT NULL UNIQUE,
        SupplierName      varchar(120)  NULL,
        ZoneCode          char(6)       NULL,
        SegmentCode       char(6)       NULL,
        SupplierTypeCode  char(6)       NULL,
        IsInactive        bit           NOT NULL,
        LoadedAtUtc       datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saProveedor')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saProveedor', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Supplier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saProveedor');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_Supplier AS tgt
    USING (
        SELECT
            RTRIM(src.co_prov) AS SupplierCode, src.prov_des AS SupplierName,
            src.co_zon AS ZoneCode, src.co_seg AS SegmentCode, src.tip_pro AS SupplierTypeCode,
            ISNULL(src.inactivo, 0) AS IsInactive
        FROM Ncake_a.dbo.saProveedor src
        WHERE src.validador > @Watermark
    ) AS src
        ON tgt.SupplierCode = src.SupplierCode COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.SupplierName = src.SupplierName,
        tgt.ZoneCode = src.ZoneCode,
        tgt.SegmentCode = src.SegmentCode,
        tgt.SupplierTypeCode = src.SupplierTypeCode,
        tgt.IsInactive = src.IsInactive,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (SupplierCode, SupplierName, ZoneCode, SegmentCode, SupplierTypeCode, IsInactive)
        VALUES (src.SupplierCode, src.SupplierName, src.ZoneCode, src.SegmentCode, src.SupplierTypeCode, src.IsInactive);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saProveedor;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saProveedor';
END
GO
```

- [ ] **Step 2: Run the migration and load**

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -i dwh-migrations/0020_dim_supplier.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "EXEC dwh.Load_Dim_Supplier;"
```

Expected: both succeed with no errors.

- [ ] **Step 3: Live-verify row count matches source**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d Ncake_a -Q "SELECT COUNT(*) AS Total FROM saProveedor;" -W -s"|"
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "SELECT COUNT(*) AS Total FROM dim.Dim_Supplier;" -W -s"|"
```

Expected: both counts match (155 in `saProveedor` as verified live 2026-09-12 — re-verify current count, it may have changed).

- [ ] **Step 4: Commit**

```bash
git add dwh-migrations/0020_dim_supplier.sql
git commit -m "$(cat <<'EOF'
feat: add Dim_Supplier dimension

Type 1 dimension sourced from saProveedor, mirroring Dim_SalesRep's
simpler pattern rather than Dim_Customer's SCD Type 2 — suppliers are
only used for top-supplier-by-spend rollups here, no history need.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `Fact_Purchases` fact table and ETL

**Files:**
- Create: `dwh-migrations/0021_fact_purchases.sql`

**Interfaces:**
- Consumes: `dim.Dim_Supplier` (Task 1), `dim.Dim_Product`, `dim.Dim_Date`, `dim.Dim_Currency` (all pre-existing).
- Produces: `fact.Fact_Purchases` table (`FactPurchaseKey`, `DateKey`, `SupplierKey`, `ProductKey`, `CurrencyKey`, `InvoiceNumber`, `LineNumber`, `QuantityPurchased`, `GrossAmount`, `DiscountAmount`, `TaxAmount`, `NetAmount`, `DocumentExchangeRate`, `IsVoided`, `LoadedAtUtc`) and `dwh.Load_Fact_Purchases` procedure. Task 4 (Compras route) queries this table.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0021_fact_purchases.sql`:

```sql
-- Mirrors fact.Fact_Sales's exact grain and ETL pattern
-- (dwh-migrations/0009_fact_sales.sql): one row per invoice line, header
-- (saFacturaCompra) joined to detail (saFacturaCompraReng) via doc_num,
-- watermark-incremental with the same "detail table has no validador, only
-- fe_us_mo" caveat that applies to saFacturaVentaReng (ruling confirmed
-- 2026-08-26, same pattern applies here per that ruling's own note).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Purchases' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Purchases (
        FactPurchaseKey       bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey               int             NOT NULL,
        SupplierKey           int             NOT NULL,
        ProductKey            int             NOT NULL,
        CurrencyKey           int             NULL,
        InvoiceNumber         char(20)        NOT NULL,
        LineNumber            int             NOT NULL,
        QuantityPurchased     decimal(18,5)   NOT NULL,
        GrossAmount           decimal(18,2)   NOT NULL,
        DiscountAmount        decimal(18,2)   NOT NULL,
        TaxAmount             decimal(18,2)   NOT NULL,
        NetAmount             decimal(18,2)   NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        IsVoided              bit             NOT NULL,
        LoadedAtUtc           datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Purchases_Invoice_Line UNIQUE (InvoiceNumber, LineNumber),
        CONSTRAINT FK_Fact_Purchases_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Purchases_Dim_Supplier FOREIGN KEY (SupplierKey) REFERENCES dim.Dim_Supplier(SupplierKey),
        CONSTRAINT FK_Fact_Purchases_Dim_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey),
        CONSTRAINT FK_Fact_Purchases_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey)
    );
    CREATE INDEX IX_Fact_Purchases_DateKey ON fact.Fact_Purchases (DateKey);
    CREATE INDEX IX_Fact_Purchases_SupplierKey ON fact.Fact_Purchases (SupplierKey);
    CREATE INDEX IX_Fact_Purchases_ProductKey ON fact.Fact_Purchases (ProductKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaCompraReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastValidatorDateTime, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saFacturaCompraReng', 0x0000000000000000, '1900-01-01', SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaCompra')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saFacturaCompra', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Purchases
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaCompraReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaCompra');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.total_art, r.cost_unit,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            r.reng_neto,
            f.co_prov, f.co_mone, f.tasa, f.fec_emis, ISNULL(f.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saFacturaCompraReng r
        INNER JOIN Ncake_a.dbo.saFacturaCompra f ON f.doc_num = r.doc_num
        WHERE r.fe_us_mo > @DetailWatermark OR f.validador > @HeaderWatermark
    )
    MERGE fact.Fact_Purchases AS tgt
    USING (
        SELECT
            dk.DateKey, c.reng_num, c.doc_num,
            sup.SupplierKey, prod.ProductKey, cur.CurrencyKey,
            c.total_art AS QuantityPurchased,
            (c.total_art * c.cost_unit) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.reng_neto AS NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided
        FROM Changed c
        LEFT JOIN dim.Dim_Supplier sup ON RTRIM(sup.SupplierCode) = RTRIM(c.co_prov) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        WHERE sup.SupplierKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.InvoiceNumber = src.doc_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.SupplierKey = src.SupplierKey,
        tgt.ProductKey = src.ProductKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.QuantityPurchased = src.QuantityPurchased,
        tgt.GrossAmount = src.GrossAmount,
        tgt.DiscountAmount = src.DiscountAmount,
        tgt.TaxAmount = src.TaxAmount,
        tgt.NetAmount = src.NetAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, SupplierKey, ProductKey, CurrencyKey,
            InvoiceNumber, LineNumber, QuantityPurchased, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.SupplierKey, src.ProductKey, src.CurrencyKey,
            src.doc_num, src.reng_num, src.QuantityPurchased, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saFacturaCompraReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saFacturaCompra;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saFacturaCompraReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saFacturaCompra';
END
GO
```

- [ ] **Step 2: Run the migration against the live dev DWH — depends on Task 1**

`Dim_Supplier` must already be loaded (Task 1, Step 2) before this ETL can resolve any `SupplierKey` — if run against an empty `Dim_Supplier`, every row will fail the `sup.SupplierKey IS NOT NULL` filter and zero rows will load. Verify Task 1 is complete first.

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -i dwh-migrations/0021_fact_purchases.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "EXEC dwh.Load_Fact_Purchases;"
```

Expected: both succeed with no errors.

- [ ] **Step 3: Live-verify row counts and a sample total**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d Ncake_a -Q "SELECT COUNT(*) AS Total FROM saFacturaCompraReng;" -W -s"|"
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT COUNT(*) AS Total, SUM(NetAmount) AS TotalNet FROM fact.Fact_Purchases WHERE IsVoided = 0;
" -W -s"|"
```

Expected: `Fact_Purchases` row count is close to (may be slightly less than, if some rows have unresolvable supplier/product codes) `saFacturaCompraReng`'s total row count. If the count is drastically smaller (under 80%), investigate the `Dim_Supplier`/`Dim_Product` join before proceeding — likely a collation or trimming mismatch, same class of issue as Task 3 Step 3 in the Finanzas plan.

- [ ] **Step 4: Add to the incremental load script**

Modify `scripts/dwh-incremental-load.ts`:

```ts
const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Dim_Supplier;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
EXEC dwh.Load_Fact_Purchases;
`;
```

(If the Finanzas plan's Task 2 Step 5 has already run and added `Load_Dim_ExpenseConcept`/`Load_Fact_Expenses` to this same file, merge both sets of additions rather than overwriting — read the file's current content first before editing, since these two plans may execute in either order per this plan's Global Constraints.)

- [ ] **Step 5: Add SQL Agent jobsteps**

Create `dwh-migrations/0022_add_purchases_jobsteps.sql`, following the exact same pattern as the Finanzas plan's `0019_add_expense_jobsteps.sql` (append at end, chain the former-last-step forward, new true-last-step stays terminal):

```sql
-- Adds Load_Dim_Supplier and Load_Fact_Purchases as new steps at the END of
-- the existing 'DWH - Incremental Load' job. Same pattern and rationale as
-- 0019_add_expense_jobsteps.sql (which this migration may run before or
-- after, depending on execution order — both are idempotent and each only
-- touches the step that is last AT THE TIME IT RUNS, so running both in
-- either order converges to the same correct end state: every step chains
-- to the next via on_success_action = 3 except the true final step).
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load')
BEGIN
    DECLARE @job_id UNIQUEIDENTIFIER = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load');
    DECLARE @max_step_id INT = (SELECT MAX(step_id) FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id);
    DECLARE @supplier_step_id INT = @max_step_id + 1;
    DECLARE @purchase_step_id INT = @max_step_id + 2;

    EXEC msdb.dbo.sp_update_jobstep @job_id = @job_id, @step_id = @max_step_id, @on_success_action = 3;

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Dim_Supplier')
    BEGIN
        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @supplier_step_id,
            @step_name = N'Load_Dim_Supplier',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Dim_Supplier;',
            @on_success_action = 3;
    END

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Fact_Purchases')
    BEGIN
        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @purchase_step_id,
            @step_name = N'Load_Fact_Purchases',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Fact_Purchases;',
            @on_success_action = 1;
    END
END
GO
```

**Important ordering note**: if this migration runs AFTER the Finanzas plan's `0019_add_expense_jobsteps.sql` already ran and left `Load_Fact_Expenses` as the terminal step with `on_success_action = 1`, this migration's `sp_update_jobstep @step_id = @max_step_id, @on_success_action = 3` call correctly un-terminalizes it (since this migration's new steps now come after it), and its own new terminal step (`Load_Fact_Purchases`) becomes the one with `on_success_action = 1`. This is exactly the intended, order-independent convergent behavior — do not skip the `sp_update_jobstep` call on the reasoning that "0019 already handled chaining," since 0019 only knew about the job's state as of when *it* ran.

- [ ] **Step 6: Run the jobstep migration and verify live**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -i dwh-migrations/0022_add_purchases_jobsteps.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -Q "
SELECT js.step_id, js.step_name, js.on_success_action
FROM msdb.dbo.sysjobsteps js JOIN msdb.dbo.sysjobs j ON j.job_id = js.job_id
WHERE j.name = 'DWH - Incremental Load' ORDER BY js.step_id;
" -W -s"|"
```

Expected: every step has `on_success_action = 3` except the true final step (whichever procedure was added last across both this plan and the Finanzas plan), which has `on_success_action = 1`. Do not assume this from the migration succeeding — run this exact query and read the output.

- [ ] **Step 7: Commit**

```bash
git add dwh-migrations/0021_fact_purchases.sql dwh-migrations/0022_add_purchases_jobsteps.sql scripts/dwh-incremental-load.ts
git commit -m "$(cat <<'EOF'
feat: add Fact_Purchases ETL mirroring Fact_Sales

Sources fact.Fact_Purchases from saFacturaCompra/saFacturaCompraReng,
watermark-incremental exactly like Fact_Sales. Wires the new
procedures into the incremental load script and SQL Agent job,
including on_success_action chaining.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `proveedor` dimension in the generic pivot query-builder

**Files:**
- Modify: `app/api/dwh/lib/query-builder.ts`

**Interfaces:**
- Consumes: `dim.Dim_Supplier` (Task 1).
- Produces: a new `'proveedor'` member of the `Dimension` union and its `DimensionSpec` entry in `DIMENSION_SPECS`. Task 4 (Compras route) uses this as the top-level grouping dimension for the "top suppliers" view.

- [ ] **Step 1: Read the current `query-builder.ts` in full**

This file already defines `Dimension`, `DimensionSpec`, and 4 existing entries (`cliente_entidad`, `cliente_tienda`, `producto`, `vendedor`) — read all of them before adding a 5th, matching their exact style (especially the `correlate()` function's documented alias-collision-avoidance rationale from the 2026-09-10 project).

- [ ] **Step 2: Add the `proveedor` dimension**

Extend the `Dimension` union:

```ts
export type Dimension = 'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor' | 'proveedor';
```

Add to `DIMENSION_SPECS`, following the exact same shape as the existing `vendedor` entry (simple single-table join, `correlate()` on the dimension's own joined alias, not the fact-table alias — per the existing code's documented SQL Server 8120 avoidance rule):

```ts
proveedor: {
  joinClause: 'JOIN dim.Dim_Supplier s ON s.SupplierKey = f.SupplierKey',
  groupByColumn: 's.SupplierKey, ISNULL(s.SupplierName, s.SupplierCode)',
  labelExpr: 'ISNULL(s.SupplierName, s.SupplierCode)',
  valueExpr: 'CAST(s.SupplierKey AS varchar(20))',
  // Correlates on `s.SupplierKey` (grouped alias), not `${outerAlias}.SupplierKey`.
  correlate: (_outerAlias, innerAlias) => ({
    innerJoin: '',
    condition: `${innerAlias}.SupplierKey = s.SupplierKey`,
  }),
},
```

Update `isDimension()` to include `'proveedor'`:

```ts
export function isDimension(value: string | null): value is Dimension {
  return value === 'cliente_entidad' || value === 'cliente_tienda' || value === 'producto' || value === 'vendedor' || value === 'proveedor';
}
```

Do NOT add `'proveedor'` to `isClienteDimension()` — that guard is intentionally narrow to `cliente_entidad`/`cliente_tienda` only, per its existing documentation; `proveedor` is a top-level grouping dimension for Compras specifically, analogous to how `vendedor` is never a `clienteDimension` value either.

- [ ] **Step 3: Write and run a unit test**

Read `app/api/dwh/lib/__tests__/query-builder.test.ts` in full first, then add a test following its exact existing structure/style for the new dimension:

```ts
test('proveedor dimension has correct join and grouping', () => {
  const spec = getDimensionSpec('proveedor');
  expect(spec.joinClause).toContain('Dim_Supplier');
  expect(spec.groupByColumn).toContain('SupplierKey');
  expect(isDimension('proveedor')).toBe(true);
});
```

(Match this codebase's actual test runner/assertion syntax — check the top of the existing test file for the exact import statements and adjust accordingly; do not assume Jest/Vitest/Bun-test syntax without checking.)

```bash
bun test app/api/dwh/lib/__tests__/query-builder.test.ts
```

Expected: PASS, including the new test and all pre-existing ones.

- [ ] **Step 4: Live-verify the join against real data**

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT TOP 5 CAST(s.SupplierKey AS varchar(20)) AS GroupValue, ISNULL(s.SupplierName, s.SupplierCode) AS GroupLabel, SUM(fp.NetAmount) AS Total
FROM fact.Fact_Purchases fp
JOIN dim.Dim_Supplier s ON s.SupplierKey = fp.SupplierKey
WHERE fp.IsVoided = 0
GROUP BY s.SupplierKey, ISNULL(s.SupplierName, s.SupplierCode)
ORDER BY Total DESC;
" -W -s"|"
```

Expected: a ranked list of real supplier names with sensible totals.

- [ ] **Step 5: Commit**

```bash
git add app/api/dwh/lib/query-builder.ts app/api/dwh/lib/__tests__/query-builder.test.ts
git commit -m "$(cat <<'EOF'
feat: add proveedor dimension to generic pivot query-builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Compras API route

**Files:**
- Create: `app/api/dwh/compras/route.ts`
- Modify: `app/(app)/analitica/types.ts`

**Interfaces:**
- Consumes: `fact.Fact_Purchases`, `dim.Dim_Supplier` (Tasks 1-2), the `proveedor`/`producto` dimensions (Task 3, plus the pre-existing `producto`).
- Produces: `ComprasResponse` type and the route's `GET` handler, structured identically to `app/api/dwh/ventas/route.ts`. Task 5 (tab) consumes this directly.

- [ ] **Step 1: Read `app/api/dwh/ventas/route.ts` in full**

This task mirrors it almost line-for-line — read the entire current file (including the 2026-09-12 línea→producto breakdown addition) before writing the Compras equivalent, so the two stay structurally consistent.

- [ ] **Step 2: Add `ComprasResponse`/`ComprasRow` types**

In `app/(app)/analitica/types.ts`, add (mirroring `VentasRow`/`VentasResponse` exactly, swapping "return rate" for a purchases-appropriate metric — purchases have no returns-tracking equivalent in scope per the spec, so omit `returnRate`):

```ts
// Compras tab
export interface ComprasRow {
  label: string;
  value: string;
  purchasesNet: number;
  avgDiscount: number | null;
}

export interface ComprasResponse {
  rows: ComprasRow[];
  groupBy: GroupBy;
  breadcrumb: Array<{ label: string; groupBy: GroupBy }>;
  usdRate: number | null;
}
```

- [ ] **Step 3: Write the Compras route**

Create `app/api/dwh/compras/route.ts`, mirroring `ventas/route.ts`'s structure:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { getDb } from '@/lib/db/sqlite';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getUsdRate, buildDateWhereClause, getDimensionSpec, isDimension, type Dimension } from '@/app/api/dwh/lib/query-builder';
import type { ComprasResponse, ComprasRow, GroupBy } from '@/app/(app)/analitica/types';

export const dynamic = 'force-dynamic';

// Mirrors app/api/dwh/ventas/route.ts's structure exactly (mes/proveedor/
// linea groupBy levels, producto breakdown on the linea level) — see that
// file for the pattern this one follows.

function monthlyQuery(dateWhere: string): string {
  return `
    SELECT
      d.YearMonth AS GroupValue,
      d.YearMonth AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY d.YearMonth
    ORDER BY d.YearMonth
  `;
}

function proveedorQuery(dateWhere: string, monthFilter: string): string {
  const spec = getDimensionSpec('proveedor');
  return `
    SELECT TOP 15
      ${spec.valueExpr.replace(/\bs\b/g, 's')} AS GroupValue,
      ${spec.labelExpr} AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    ${spec.joinClause.replace(/\bf\b/g, 'fp')}
    JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
    WHERE fp.IsVoided = 0 ${dateWhere} ${monthFilter}
    GROUP BY ${spec.groupByColumn}
    ORDER BY PurchasesNet DESC
  `;
}

function lineaQuery(dateWhere: string): string {
  return `
    SELECT TOP 30
      ISNULL(p.LineCode, 'SIN_LINEA') AS GroupValue,
      ISNULL(p.LineName, 'Sin línea') AS GroupLabel,
      SUM(fp.NetAmount) AS PurchasesNet,
      SUM(fp.GrossAmount) AS GrossAmount,
      SUM(fp.DiscountAmount) AS DiscountAmount
    FROM fact.Fact_Purchases fp
    JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
    WHERE fp.IsVoided = 0 ${dateWhere}
    GROUP BY ISNULL(p.LineCode, 'SIN_LINEA'), ISNULL(p.LineName, 'Sin línea')
    ORDER BY PurchasesNet DESC
  `;
}

function breakdownQuery(dimension: Dimension, dateWhere: string): string {
  const spec = getDimensionSpec(dimension);
  return `
    SELECT TOP 15 ${spec.valueExpr} AS GroupValue, ${spec.labelExpr} AS GroupLabel, SUM(fp.NetAmount) AS PurchasesNet
    FROM fact.Fact_Purchases fp
    ${spec.joinClause.replace(/\bf\b/g, 'fp')}
    WHERE fp.IsVoided = 0 AND ${spec.correlate('fp', 'fp2').condition.replace('fp2', 'fp')} ${dateWhere}
    GROUP BY ${spec.groupByColumn}
    ORDER BY PurchasesNet DESC
  `;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]} ${y.slice(2)}` : ym;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasDwhAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get('dateRange') ?? '12m';
  const currency = searchParams.get('currency') ?? 'bs';
  const groupByParam = searchParams.get('groupBy') ?? 'mes';
  const groupBy: GroupBy = groupByParam === 'proveedor' || groupByParam === 'linea' ? groupByParam : 'mes';
  const breakdownByParam = searchParams.get('breakdownBy');
  const breakdownBy: Dimension | null = isDimension(breakdownByParam) ? breakdownByParam : null;
  const parentValue = searchParams.get('parentValue');
  const month = searchParams.get('month');

  try {
    const pool = await getDwhPool();
    const dateWhere = buildDateWhereClause(dateRange, 'fp');

    if (breakdownBy && parentValue) {
      const req = pool.request();
      req.input('parentValue', parentValue);
      const spec = getDimensionSpec(breakdownBy);
      const result = await req.query(`
        SELECT TOP 15 ${spec.valueExpr} AS GroupValue, ${spec.labelExpr} AS GroupLabel, SUM(fp.NetAmount) AS PurchasesNet
        FROM fact.Fact_Purchases fp
        JOIN dim.Dim_Product p ON p.ProductKey = fp.ProductKey
        ${spec.joinClause.replace(/\bf\b/g, 'fp')}
        WHERE fp.IsVoided = 0 AND ISNULL(p.LineCode, 'SIN_LINEA') = @parentValue ${dateWhere}
        GROUP BY ${spec.groupByColumn}
        ORDER BY PurchasesNet DESC
      `);
      return NextResponse.json({ breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), purchasesNet: Number(r.PurchasesNet) })) });
    }

    let recordset: Record<string, unknown>[];
    const breadcrumb: ComprasResponse['breadcrumb'] = [{ label: 'Compras', groupBy: 'mes' }];

    if (groupBy === 'proveedor') {
      let monthFilter = '';
      const req = pool.request();
      if (month) {
        req.input('month', month);
        monthFilter = 'AND d.YearMonth = @month';
      }
      const result = await req.query(proveedorQuery(dateWhere, monthFilter));
      recordset = result.recordset;
      breadcrumb.push({ label: month ? formatYearMonth(month) : 'Proveedores', groupBy: 'proveedor' });
    } else if (groupBy === 'linea') {
      const result = await pool.request().query(lineaQuery(dateWhere));
      recordset = result.recordset;
      breadcrumb.push({ label: 'Líneas', groupBy: 'linea' });
    } else {
      const result = await pool.request().query(monthlyQuery(dateWhere));
      recordset = result.recordset;
    }

    const usdRate = currency === 'usd' ? await getUsdRate() : null;

    const rows: ComprasRow[] = recordset.map(r => {
      const purchasesNet = Number(r.PurchasesNet);
      const grossAmount = Number(r.GrossAmount);
      const discountAmount = Number(r.DiscountAmount);
      const label = groupBy === 'mes' ? formatYearMonth(String(r.GroupLabel)) : String(r.GroupLabel);
      return {
        label,
        value: String(r.GroupValue),
        purchasesNet,
        avgDiscount: grossAmount > 0 ? discountAmount / grossAmount : null,
      };
    });

    return NextResponse.json({ rows, groupBy, breadcrumb, usdRate } satisfies ComprasResponse);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
```

Note the unused `breakdownQuery` helper function defined above but not called from `GET` — the actual línea→producto breakdown is inlined directly in the `breakdownBy && parentValue` branch instead (mirroring how Ventas' equivalent evolved on 2026-09-12: the línea breakdown needed a different WHERE clause shape than the generic dimension-to-dimension breakdown). Delete the unused `breakdownQuery` function before finishing this task — it was scaffolded here as a first draft but the inline version in `GET` supersedes it; leaving unreferenced dead code is not acceptable per this project's YAGNI conventions.

- [ ] **Step 2: Run typecheck**

```bash
bun run tsc --noEmit -p .
```

Expected: no new errors beyond the pre-existing 5 in `__tests__/integration/inventory-change-unit.integration.test.ts`. Fix the dangling `breakdownQuery` reference (from the note above) if the compiler flags it as unused — check the project's lint config for whether unused functions actually fail typecheck or only lint; delete it regardless per the note above.

- [ ] **Step 3: Live-verify the route's queries directly**

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT d.YearMonth AS GroupValue, d.YearMonth AS GroupLabel, SUM(fp.NetAmount) AS PurchasesNet
FROM fact.Fact_Purchases fp JOIN dim.Dim_Date d ON d.DateKey = fp.DateKey
WHERE fp.IsVoided = 0
GROUP BY d.YearMonth ORDER BY d.YearMonth;
" -W -s"|"
```

Expected: a monthly trend with real totals matching the data range found during brainstorming (Compras source data in this dev DB — verify the actual date range live, don't assume it matches `Fact_Sales`'s March–July 2026 window without checking, since `saFacturaCompra` may have a different date span).

- [ ] **Step 4: Commit**

```bash
git add app/api/dwh/compras/route.ts app/\(app\)/analitica/types.ts
git commit -m "$(cat <<'EOF'
feat: add Compras API route mirroring Ventas structure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Compras tab UI, replacing the stub

**Files:**
- Create: `app/(app)/analitica/tabs/tab-compras.tsx`
- Modify: `app/(app)/analitica/analitica-client.tsx`
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: `ComprasResponse` (Task 4), the shared `GroupedDrilldownTable` component.

- [ ] **Step 1: Read `tab-ventas.tsx` in full**

This task mirrors it closely — read the entire current file (post-2026-09-12 línea breakdown changes) before writing `tab-compras.tsx`.

- [ ] **Step 2: Write `tab-compras.tsx`**

Mirror `tab-ventas.tsx`'s structure: a `groupBy` state (`'mes' | 'proveedor' | 'linea'`), a monthly bar chart with drill-into-proveedor-for-that-month on click, a `GroupedDrilldownTable` for the `proveedor` view (single grouping option, no Entidad/Tienda-style toggle — suppliers don't have the multi-store fragmentation problem customers do, so this is simpler than Ventas' cliente view), and a `GroupedDrilldownTable` for the `linea` view with a producto breakdown (mirroring Ventas' 2026-09-12 línea→producto addition exactly).

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import GroupedDrilldownTable, { type DrilldownColumn } from '../components/grouped-drilldown-table';
import type { BreakdownRow, ComprasResponse, ComprasRow, Currency, DateRange, GroupBy, PivotDimension } from '../types';

function money(n: number, currency: Currency = 'bs', rate?: number): string {
  if (currency === 'usd' && rate) {
    n = n / rate;
  }
  const format = currency === 'usd'
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
    : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  return format.format(n);
}

function moneyLabel(n: number, currency: Currency, rate?: number): string {
  return `${currency === 'usd' ? '$' : 'Bs. '}${money(n, currency, rate)}`;
}

function moneyTooltip(value: unknown, currency: Currency = 'bs', rate?: number): string {
  const numVal = Number(Array.isArray(value) ? value[0] : value);
  return moneyLabel(numVal, currency, rate);
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400 text-center px-4">
      {message ?? 'Sin datos disponibles todavía.'}
    </div>
  );
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'mes', label: 'Por mes' },
  { value: 'proveedor', label: 'Por proveedor' },
  { value: 'linea', label: 'Por línea' },
];

const PROVEEDOR_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'proveedor', label: 'Proveedor' },
];

const LINEA_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Línea' },
];

const LINEA_BREAKDOWN_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Producto' },
];

interface ComprasTableRow extends ComprasRow {
  label: string;
  value: string;
}

export default function TabCompras({
  dateRange,
  currency,
}: {
  dateRange: DateRange;
  currency: Currency;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>('mes');
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<ComprasResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lineaBreakdownBy, setLineaBreakdownBy] = useState<PivotDimension | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ dateRange, currency, groupBy });
        if (groupBy === 'proveedor' && month) params.set('month', month);
        const res = await fetch(`/api/dwh/compras?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Error desconocido');
          return;
        }
        const body: ComprasResponse = await res.json();
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError('No se pudo conectar con el servidor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange, currency, groupBy, month]);

  function handleGroupByChange(next: GroupBy) {
    if (next !== 'proveedor') setMonth(null);
    setGroupBy(next);
  }

  function handleBarClick(value: string) {
    if (groupBy === 'mes') {
      setMonth(value);
      setGroupBy('proveedor');
    }
  }

  const rate = data?.usdRate ?? undefined;
  const chartData = (data?.rows ?? []).map(r => ({
    label: r.label,
    value: String(r.value),
    purchasesNet: r.purchasesNet,
  }));

  const tableRows: ComprasTableRow[] = useMemo(
    () => (data?.rows ?? []).map(r => ({ ...r, label: r.label, value: String(r.value) })),
    [data]
  );

  async function handleFetchLineaBreakdown(parentValue: string, dimension: PivotDimension): Promise<BreakdownRow[]> {
    const params = new URLSearchParams({ dateRange, currency, groupBy: 'linea', breakdownBy: dimension, parentValue });
    const res = await fetch(`/api/dwh/compras?${params.toString()}`);
    if (!res.ok) return [];
    const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
    return body.breakdown ?? [];
  }

  const columns: DrilldownColumn<ComprasTableRow>[] = [
    {
      key: 'purchasesNet',
      label: 'Compras netas',
      align: 'right',
      format: row => moneyLabel(row.purchasesNet, currency, rate),
    },
    {
      key: 'avgDiscount',
      label: 'Desc. prom.',
      align: 'right',
      format: row => (row.avgDiscount !== null ? `${(row.avgDiscount * 100).toFixed(1)}%` : '—'),
    },
  ];

  const subtitleByGroupBy: Record<GroupBy, string> = {
    mes: 'Compras netas por mes — clic en una barra para ver proveedores de ese mes',
    proveedor: month ? 'Top proveedores del mes seleccionado' : 'Top proveedores por monto',
    linea: 'Compras netas por línea de producto',
  };

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
          {GROUP_BY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleGroupByChange(opt.value)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                groupBy === opt.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {data && data.breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            {data.breadcrumb.map((crumb, i) => (
              <span key={`${crumb.groupBy}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className="font-medium text-gray-800">{crumb.label}</span>
              </span>
            ))}
          </nav>
        )}
      </div>

      {loading && <div className="p-6 text-sm text-gray-500">Cargando…</div>}

      {!loading && error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      )}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-900">Tendencia de compras</h2>
          <p className="text-xs text-gray-500 mb-3">{subtitleByGroupBy[groupBy]}</p>
          {chartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={chartData} layout={groupBy === 'mes' ? 'horizontal' : 'vertical'} margin={{ top: 8, left: groupBy === 'mes' ? 0 : 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                {groupBy === 'mes' ? (
                  <>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => money(v, currency, rate)} />
                  </>
                ) : (
                  <>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => money(v, currency, rate)} />
                    <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
                  </>
                )}
                <Tooltip formatter={val => moneyTooltip(val, currency, rate)} />
                <Bar
                  dataKey="purchasesNet"
                  fill="#2563eb"
                  radius={groupBy === 'mes' ? [3, 3, 0, 0] : [0, 3, 3, 0]}
                  cursor={groupBy === 'mes' ? 'pointer' : undefined}
                  onClick={groupBy === 'mes' ? (entry: any) => handleBarClick(entry.payload?.value) : undefined}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {!loading && !error && data && groupBy === 'proveedor' && (
        <GroupedDrilldownTable<ComprasTableRow>
          rows={tableRows}
          columns={columns}
          groupByOptions={PROVEEDOR_GROUP_BY_OPTIONS}
          groupBy="proveedor"
          onGroupByChange={() => {}}
          formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
        />
      )}

      {!loading && !error && data && groupBy === 'linea' && (
        <GroupedDrilldownTable<ComprasTableRow>
          rows={tableRows}
          columns={columns}
          groupByOptions={LINEA_GROUP_BY_OPTIONS}
          groupBy="producto"
          onGroupByChange={() => {}}
          breakdownByOptions={LINEA_BREAKDOWN_BY_OPTIONS}
          breakdownBy={lineaBreakdownBy}
          onBreakdownByChange={setLineaBreakdownBy}
          onFetchBreakdown={handleFetchLineaBreakdown}
          formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab into `analitica-client.tsx`**

Replace the Compras stub entry:

```tsx
import TabCompras from './tabs/tab-compras';
```

```tsx
{ key: 'compras', label: 'Compras', component: TabCompras },
```

(Remove the `() => <TabStub title="Compras" />` inline entry it replaces. Check whether `TabStub`/`tab-stub.tsx` is still used by any other tab — `rutas`/`Rutas y Logística` still uses it per the current file — do not delete `tab-stub.tsx` itself, only this one usage.)

- [ ] **Step 4: Verify in the browser**

Run the dev server, log in, navigate to the Compras tab. Confirm the monthly chart renders, clicking a bar drills into proveedores for that month, the línea view's breakdown expands into productos, and currency toggle/date-range (including custom range) all work correctly from the first render.

- [ ] **Step 5: Extend E2E coverage**

Read the existing `e2e/analitica.spec.ts` in full, then add a test navigating to the Compras tab, asserting the monthly chart renders, clicking into a proveedor drilldown, and expanding a línea breakdown.

- [ ] **Step 6: Run the E2E suite**

```bash
bun run e2e:seed
bunx playwright test e2e/analitica.spec.ts --grep "Compras"
```

Expected: PASS. Use `nvm use 20` first if `bun`/local Node resolves below v20 (pre-existing local environment note, not a task blocker).

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-compras.tsx app/\(app\)/analitica/analitica-client.tsx e2e/analitica.spec.ts
git commit -m "$(cat <<'EOF'
feat: replace Compras stub with real supplier/purchases tab

Mirrors the Ventas tab structure: monthly trend, top-proveedores
drilldown, línea→producto breakdown.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Task: Full regression pass

**Files:** none new.

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/eugenio/repos/new-york-venezuela/profitplus-exporter
bun run tsc --noEmit -p .
```

Expected: no new errors beyond the pre-existing 5 in `__tests__/integration/inventory-change-unit.integration.test.ts`.

- [ ] **Step 2: Full E2E suite**

```bash
bun run e2e:seed
bunx playwright test e2e/analitica.spec.ts
```

Expected: PASS, all tests including Compras' new coverage.

- [ ] **Step 3: Re-run the full incremental load end-to-end**

```bash
bun run scripts/dwh-incremental-load.ts
```

Expected: succeeds with no errors, all procedures (including any from the Finanzas plan, if it has also run) execute in dependency order.

- [ ] **Step 4: Manual browser verification**

Full click-through of the Compras tab: all 3 groupBy levels, currency toggle, date-range including custom.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` for the full diff on `feature/finanzas-compras-facts` (covering both this plan and the Finanzas plan, if both have run on this branch) before merging or opening a PR.
