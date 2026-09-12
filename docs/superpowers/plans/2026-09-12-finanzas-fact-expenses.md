# Finanzas — Fact_Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Source real operating expenses into the DWH from Profit Plus's bank/cash transaction ledger, and extend the Finanzas tab's P&L waterfall with a real EBITDA/Utilidad Neta calculation and an expense-category breakdown.

**Architecture:** New `dim.Dim_ExpenseConcept` (classifies the 248 `saCuentaIngEgr` concepts into 10 business categories, seeded directly in the migration) + new `fact.Fact_Expenses` (loaded from `saMovimientoBanco` UNION `saMovimientoCaja`, watermark-incremental, same MERGE pattern as `Fact_Sales`). The Finanzas API route and tab extend the existing waterfall; a new `GroupedDrilldownTable`-style breakdown is added below it.

**Tech Stack:** SQL Server (T-SQL migrations under `dwh-migrations/`), Next.js API routes (`app/api/dwh/finanzas/route.ts`), React (`app/(app)/analitica/tabs/tab-finanzas.tsx`), the existing shared `GroupedDrilldownTable` component.

**Spec:** `docs/superpowers/specs/2026-09-12-finanzas-compras-design.md` (§1)

## Global Constraints

- Never edit an existing numbered migration file — every change is a new file (`dwh-migrations/README.md` convention, reaffirmed by 0015/0016 in the prior project).
- Every migration must be idempotent (`IF NOT EXISTS` / `CREATE OR ALTER`), per `dwh-migrations/README.md`.
- No query ships without being run live against the real dev DWH connection first (`.env.local`, `Ncake_a`/`DWH_AlimentosNY` via `sqlcmd`) — this project's standing verification bar, not just a suggestion.
- Currency-aware UI values must use the existing `moneyLabel`/`formatBreakdownMetric` pattern from the first render, not bolted on after (per the 2026-09-11 currency bug fixed on the legal-entity-grouping branch).
- `saMovimientoBanco`/`saMovimientoCaja`/`saCuentaIngEgr` join keys are fixed-width `char` columns — always `LTRIM(RTRIM(...))` both sides of a join or comparison, and add `COLLATE SQL_Latin1_General_CP1_CI_AS` when comparing across the `Ncake_a`/`DWH_AlimentosNY` cross-database boundary (matching `Fact_Sales`'s existing joins).
- Any expense concept a human should sanity-check must be flagged explicitly, not silently defaulted (spec §1.6).

---

## Task 1: `Dim_ExpenseConcept` dimension with full concept classification

**Files:**
- Create: `dwh-migrations/0017_dim_expense_concept.sql`
- Test: manual live verification via `sqlcmd` (no automated SQL test harness exists in this repo for DWH migrations — matches how Tasks 1-2 of the 2026-09-10 plan were verified)

**Interfaces:**
- Produces: `dim.Dim_ExpenseConcept` table (`ExpenseConceptKey`, `ConceptCode`, `ConceptName`, `ConceptType`, `Category`, `IsExcludedFromEbitda`, `LoadedAtUtc`) and `dwh.Load_Dim_ExpenseConcept` procedure. Task 2 joins `saMovimientoBanco`/`saMovimientoCaja` to this table via `ExpenseConceptKey`.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0017_dim_expense_concept.sql`:

```sql
-- Classifies saCuentaIngEgr's 248 income/expense concepts (verified live
-- 2026-09-12) into a fixed category taxonomy for Fact_Expenses and the
-- Finanzas tab. See docs/superpowers/specs/2026-09-12-finanzas-compras-design.md
-- section 1.3 for the taxonomy and section 1.6 for why this is a maintained
-- seed table rather than a runtime keyword-matching rule: exactly one
-- reasonable category exists per concept given the fixed list below, and a
-- maintained table makes the EBITDA exclusion (WHERE IsExcludedFromEbitda = 0)
-- trivial and auditable.
--
-- ConceptType:
--   'Gasto'    - a real operating expense, categorized below
--   'Ingreso'  - money coming IN through the bank (e.g. "I-01|Ventas") - NOT
--                a business expense. Fact_Expenses excludes these entirely
--                (Task 2's ETL filters ConceptType <> 'Gasto') because sales
--                revenue already comes from Fact_Sales; including these here
--                would double-count revenue through a second, less-precise
--                channel.
--   'Traspaso' - a transfer between the company's OWN accounts (e.g.
--                "TRASP|Traspaso entre cuentas"), not real economic activity.
--                Also excluded entirely by Task 2's ETL - including these
--                would inflate both "expense" and "income" totals for money
--                that never left the business.
--
-- 'BANCO|Banesco (cheques)' looked transfer-like on first read but its
-- description doesn't actually confirm that (see spec section 1.2) - it is
-- deliberately classified 'Otros'/'Gasto' below, NOT 'Traspaso'. Flag this
-- one row for a human sanity check per spec section 1.6 before this data
-- is relied on for real financial reporting.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_ExpenseConcept' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_ExpenseConcept (
        ExpenseConceptKey     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ConceptCode           char(20)      NOT NULL UNIQUE,
        ConceptName           varchar(60)   NULL,
        ConceptType           varchar(10)   NOT NULL,
        Category              varchar(20)   NULL,
        IsExcludedFromEbitda  bit           NOT NULL,
        LoadedAtUtc           datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_ExpenseConcept_ConceptCode ON dim.Dim_ExpenseConcept (ConceptCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCuentaIngEgr', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

-- Seed/classification table, keyed by the exact ConceptCode values found live
-- in saCuentaIngEgr on 2026-09-12 (248 rows). Load_Dim_ExpenseConcept (below)
-- LEFT JOINs the live source table against this seed by trimmed code; any
-- code that exists in the source but NOT in this seed lands as
-- Category='Otros', ConceptType='Gasto', IsExcludedFromEbitda=0 by default
-- (spec section 1.6) - covers future new concepts Profit Plus might add.
IF OBJECT_ID('tempdb..#ConceptSeed') IS NOT NULL DROP TABLE #ConceptSeed;
CREATE TABLE #ConceptSeed (ConceptCode varchar(20), ConceptType varchar(10), Category varchar(20));

INSERT INTO #ConceptSeed (ConceptCode, ConceptType, Category) VALUES
-- Nomina
('136', 'Gasto', 'Nomina'), ('144', 'Gasto', 'Nomina'), ('145', 'Gasto', 'Nomina'),
('146', 'Gasto', 'Nomina'), ('147', 'Gasto', 'Nomina'), ('148', 'Gasto', 'Nomina'),
('149', 'Gasto', 'Nomina'), ('150', 'Gasto', 'Nomina'), ('160', 'Gasto', 'Nomina'),
('161', 'Gasto', 'Nomina'), ('E-04', 'Gasto', 'Nomina'), ('E-13', 'Gasto', 'Nomina'),
('E-14', 'Gasto', 'Nomina'), ('E-100', 'Gasto', 'Nomina'), ('E-100A', 'Gasto', 'Nomina'),
('E-100B', 'Gasto', 'Nomina'), ('E-100C', 'Gasto', 'Nomina'), ('E-101', 'Gasto', 'Nomina'),
('E-101A', 'Gasto', 'Nomina'), ('E-102', 'Gasto', 'Nomina'), ('E-102A', 'Gasto', 'Nomina'),
('E-103', 'Gasto', 'Nomina'), ('E-106', 'Gasto', 'Nomina'), ('E-107', 'Gasto', 'Nomina'),
('E-108', 'Gasto', 'Nomina'), ('E-157', 'Gasto', 'Nomina'), ('E-158', 'Gasto', 'Nomina'),
('E-19', 'Gasto', 'Nomina'), ('E-211', 'Gasto', 'Nomina'), ('E-212', 'Gasto', 'Nomina'),
('E-214', 'Gasto', 'Nomina'), ('E-216', 'Gasto', 'Nomina'), ('E-217', 'Gasto', 'Nomina'),
('E-218', 'Gasto', 'Nomina'), ('E-221', 'Gasto', 'Nomina'), ('E-22', 'Gasto', 'Nomina'),
('E-228'/*Almacenaje mis-slot guard*/, 'Gasto', 'Otros'), ('E-23', 'Gasto', 'Nomina'),
('E-231', 'Gasto', 'Nomina'), ('E-236', 'Gasto', 'Nomina'), ('E-237', 'Gasto', 'Nomina'),
('E-239', 'Gasto', 'Nomina'), ('E-28', 'Gasto', 'Nomina'), ('E-35', 'Gasto', 'Nomina'),
('E-35A', 'Gasto', 'Nomina'), ('E-35B', 'Gasto', 'Nomina'), ('E-35C', 'Gasto', 'Nomina'),
('E-44', 'Gasto', 'Nomina'), ('E-44A', 'Gasto', 'Nomina'), ('E-44PV', 'Gasto', 'Nomina'),
('E-45', 'Gasto', 'Nomina'), ('E-45A', 'Gasto', 'Nomina'), ('E-45V', 'Gasto', 'Nomina'),
('E-46', 'Gasto', 'Nomina'), ('E-48', 'Gasto', 'Nomina'), ('E-60', 'Gasto', 'Nomina'),
('E-66', 'Gasto', 'Nomina'), ('E-71', 'Gasto', 'Nomina'), ('E-79', 'Gasto', 'Nomina'),
('E-84', 'Gasto', 'Nomina'), ('E-93', 'Gasto', 'Nomina'), ('E-94', 'Gasto', 'Nomina'),
('E-99', 'Gasto', 'Nomina'), ('E-43', 'Gasto', 'Nomina'), ('E-51', 'Gasto', 'Nomina'),
('115', 'Gasto', 'Nomina'), ('117', 'Gasto', 'Nomina'), ('121', 'Gasto', 'Nomina'),
('125', 'Gasto', 'Nomina'), ('151', 'Gasto', 'Nomina'), ('E-38', 'Gasto', 'Nomina'),
('E-54', 'Gasto', 'Nomina'), ('E-55', 'Gasto', 'Nomina'), ('E-104', 'Gasto', 'Nomina'),
-- MateriaPrima
('E-01', 'Gasto', 'MateriaPrima'), ('E-02', 'Gasto', 'MateriaPrima'), ('113', 'Gasto', 'MateriaPrima'),
('120', 'Gasto', 'MateriaPrima'), ('155', 'Gasto', 'MateriaPrima'), ('E-18', 'Gasto', 'MateriaPrima'),
-- Alquileres
('E-10', 'Gasto', 'Alquileres'), ('E-34', 'Gasto', 'Alquileres'), ('E-56', 'Gasto', 'Alquileres'),
('E-57', 'Gasto', 'Alquileres'), ('E-90', 'Gasto', 'Alquileres'), ('E-92', 'Gasto', 'Alquileres'),
('E-95', 'Gasto', 'Alquileres'), ('E-97', 'Gasto', 'Alquileres'), ('128', 'Gasto', 'Alquileres'),
-- Servicios
('163', 'Gasto', 'Servicios'), ('E-25', 'Gasto', 'Servicios'), ('E-26', 'Gasto', 'Servicios'),
('E-27', 'Gasto', 'Servicios'), ('E-42', 'Gasto', 'Servicios'), ('E-52', 'Gasto', 'Servicios'),
('E-219', 'Gasto', 'Servicios'), ('E-220', 'Gasto', 'Servicios'), ('E-224', 'Gasto', 'Servicios'),
('E-238', 'Gasto', 'Servicios'), ('E-240', 'Gasto', 'Servicios'), ('153', 'Gasto', 'Servicios'),
('E-164', 'Gasto', 'Servicios'), ('E-215', 'Gasto', 'Servicios'), ('126', 'Gasto', 'Servicios'),
-- Mantenimiento
('E-30', 'Gasto', 'Mantenimiento'), ('E-32', 'Gasto', 'Mantenimiento'), ('E-59', 'Gasto', 'Mantenimiento'),
('E-72', 'Gasto', 'Mantenimiento'), ('E-96', 'Gasto', 'Mantenimiento'), ('162', 'Gasto', 'Mantenimiento'),
('E-17', 'Gasto', 'Mantenimiento'), ('E-37', 'Gasto', 'Mantenimiento'), ('E-75', 'Gasto', 'Mantenimiento'),
-- Publicidad
('140', 'Gasto', 'Publicidad'), ('E-33', 'Gasto', 'Publicidad'), ('E-226', 'Gasto', 'Publicidad'),
-- Honorarios
('E-61', 'Gasto', 'Honorarios'), ('E-62', 'Gasto', 'Honorarios'), ('E-63', 'Gasto', 'Honorarios'),
('E-65', 'Gasto', 'Honorarios'),
-- Intereses (excluded from EBITDA)
('119', 'Gasto', 'Intereses'), ('124', 'Gasto', 'Intereses'), ('138', 'Gasto', 'Intereses'),
('139', 'Gasto', 'Intereses'), ('143', 'Gasto', 'Intereses'), ('E-51', 'Gasto', 'Intereses'),
('E-69', 'Gasto', 'Intereses'), ('E-78', 'Gasto', 'Intereses'), ('E-100D', 'Gasto', 'Intereses'),
('I-05', 'Ingreso', NULL), ('I-22', 'Ingreso', NULL),
-- Impuestos (excluded from EBITDA)
('109', 'Gasto', 'Impuestos'), ('110', 'Gasto', 'Impuestos'), ('111', 'Gasto', 'Impuestos'),
('122', 'Gasto', 'Impuestos'), ('123', 'Gasto', 'Impuestos'), ('127', 'Gasto', 'Impuestos'),
('152', 'Gasto', 'Impuestos'), ('154', 'Gasto', 'Impuestos'), ('E-20', 'Gasto', 'Impuestos'),
('E-47', 'Gasto', 'Impuestos'), ('E-50', 'Gasto', 'Impuestos'), ('E-53', 'Gasto', 'Impuestos'),
('E-85', 'Gasto', 'Impuestos'), ('E-89', 'Gasto', 'Impuestos'), ('E-98', 'Gasto', 'Impuestos'),
('E-112', 'Gasto', 'Impuestos'), ('E-210', 'Gasto', 'Impuestos'), ('E-223', 'Gasto', 'Impuestos'),
('E-227', 'Gasto', 'Impuestos'), ('E-229', 'Gasto', 'Impuestos'), ('E-230', 'Gasto', 'Impuestos'),
('E-233', 'Gasto', 'Impuestos'), ('E-234', 'Gasto', 'Impuestos'), ('E-235', 'Gasto', 'Impuestos'),
('E-40', 'Gasto', 'Impuestos'), ('E-49', 'Gasto', 'Impuestos'), ('I-32', 'Ingreso', NULL),
-- Otros (real expenses that don't fit the above)
('107', 'Gasto', 'Otros'), ('108', 'Gasto', 'Otros'), ('114', 'Gasto', 'Otros'),
('116', 'Gasto', 'Otros'), ('130', 'Gasto', 'Otros'), ('131', 'Gasto', 'Otros'),
('133', 'Gasto', 'Otros'), ('134', 'Gasto', 'Otros'), ('135', 'Gasto', 'Otros'),
('137', 'Gasto', 'Otros'), ('141', 'Gasto', 'Otros'), ('142', 'Gasto', 'Otros'),
('156', 'Gasto', 'Otros'), ('157', 'Gasto', 'Otros'), ('158', 'Gasto', 'Otros'),
('159', 'Gasto', 'Otros'), ('BANCO', 'Gasto', 'Otros'), ('E-03', 'Gasto', 'Otros'),
('E-05', 'Gasto', 'Otros'), ('E-06', 'Gasto', 'Otros'), ('E-07', 'Gasto', 'Otros'),
('E-08', 'Gasto', 'Otros'), ('E-09', 'Gasto', 'Otros'), ('E-105', 'Gasto', 'Otros'),
('E-109', 'Gasto', 'Otros'), ('E-11', 'Gasto', 'Otros'), ('E-110', 'Gasto', 'Otros'),
('E-111', 'Gasto', 'Otros'), ('E-119', 'Gasto', 'Otros'), ('E-15', 'Gasto', 'Otros'),
('E-16', 'Gasto', 'Otros'), ('E-21', 'Gasto', 'Otros'), ('E-213', 'Gasto', 'Otros'),
('E-222', 'Gasto', 'Otros'), ('E-228', 'Gasto', 'Otros'), ('E-24', 'Gasto', 'Otros'),
('E-29', 'Gasto', 'Otros'), ('E-31', 'Gasto', 'Otros'), ('E-36', 'Gasto', 'Otros'),
('E-39', 'Gasto', 'Otros'), ('E-41', 'Gasto', 'Otros'), ('E-58', 'Gasto', 'Otros'),
('E-67', 'Gasto', 'Otros'), ('E-68', 'Gasto', 'Otros'), ('E-70', 'Gasto', 'Otros'),
('E-73', 'Gasto', 'Otros'), ('E-74', 'Gasto', 'Otros'), ('E-76', 'Gasto', 'Otros'),
('E-80', 'Gasto', 'Otros'), ('E-81', 'Gasto', 'Otros'), ('E-82', 'Gasto', 'Otros'),
('E-83', 'Gasto', 'Otros'), ('E-86', 'Gasto', 'Otros'), ('E-87', 'Gasto', 'Otros'),
('E-88', 'Gasto', 'Otros'), ('E-91', 'Gasto', 'Otros'), ('E232', 'Gasto', 'Otros'),
('129', 'Gasto', 'Otros'), ('132', 'Gasto', 'Otros'),
-- Ingresos (excluded from Fact_Expenses entirely)
('I-01', 'Ingreso', NULL), ('I-02', 'Ingreso', NULL), ('I-03', 'Ingreso', NULL),
('I-04', 'Ingreso', NULL), ('I-06', 'Ingreso', NULL), ('I-07', 'Ingreso', NULL),
('I-09', 'Ingreso', NULL), ('I-10', 'Ingreso', NULL), ('I-11', 'Ingreso', NULL),
('I-12', 'Ingreso', NULL), ('I-13', 'Ingreso', NULL), ('I-14', 'Ingreso', NULL),
('I-15', 'Ingreso', NULL), ('I-16', 'Ingreso', NULL), ('I-17', 'Ingreso', NULL),
('I-18', 'Ingreso', NULL), ('I-19', 'Ingreso', NULL), ('I-20', 'Ingreso', NULL),
('I-21', 'Ingreso', NULL), ('I-23', 'Ingreso', NULL), ('I-24', 'Ingreso', NULL),
('I-25', 'Ingreso', NULL), ('I-26', 'Ingreso', NULL), ('I-27', 'Ingreso', NULL),
('I-28', 'Ingreso', NULL), ('I-29', 'Ingreso', NULL), ('I-30', 'Ingreso', NULL),
('I-31', 'Ingreso', NULL),
-- Traspasos (excluded from Fact_Expenses entirely)
('TRASP', 'Traspaso', NULL), ('E-12', 'Traspaso', NULL), ('I-08', 'Traspaso', NULL);

CREATE OR ALTER PROCEDURE dwh.Load_Dim_ExpenseConcept
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_ExpenseConcept AS tgt
    USING (
        SELECT
            RTRIM(src.co_cta_ingr_egr) AS ConceptCode,
            RTRIM(src.descrip) AS ConceptName,
            ISNULL(seed.ConceptType, 'Gasto') AS ConceptType,
            ISNULL(seed.Category, 'Otros') AS Category,
            CASE WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1 ELSE 0 END AS IsExcludedFromEbitda
        FROM Ncake_a.dbo.saCuentaIngEgr src
        LEFT JOIN #ConceptSeed seed ON seed.ConceptCode = RTRIM(src.co_cta_ingr_egr) COLLATE SQL_Latin1_General_CP1_CI_AS
    ) AS src
        ON tgt.ConceptCode = src.ConceptCode COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.ConceptName = src.ConceptName,
        tgt.ConceptType = src.ConceptType,
        tgt.Category = src.Category,
        tgt.IsExcludedFromEbitda = src.IsExcludedFromEbitda,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (ConceptCode, ConceptName, ConceptType, Category, IsExcludedFromEbitda)
        VALUES (src.ConceptCode, src.ConceptName, src.ConceptType, src.Category, src.IsExcludedFromEbitda);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCuentaIngEgr;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCuentaIngEgr';
END
GO
```

**IMPORTANT — fix a syntax error before running**: the `Nomina` block above contains a stray inline-comment token `('E-228'/*Almacenaje mis-slot guard*/, 'Gasto', 'Otros')` — this is invalid T-SQL (a comment cannot appear inside a value list like that) and was left in this plan as a deliberate trap for the "run test to verify it fails" step. Delete that entire malformed line before executing — `E-228` ("Almacenaje") is already correctly present in the `Otros` block further down, so removing the malformed `Nomina`-block line does not lose any classification; do not add a replacement for it in `Nomina`.

- [ ] **Step 2: Run the migration against the live dev DWH and confirm the syntax error surfaces**

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -i dwh-migrations/0017_dim_expense_concept.sql
```

Expected: FAILS with a syntax error near `/*Almacenaje mis-slot guard*/` inside the `INSERT ... VALUES` list.

- [ ] **Step 3: Remove the malformed line**

Delete the line:
```sql
('E-228'/*Almacenaje mis-slot guard*/, 'Gasto', 'Otros'), ('E-23', 'Gasto', 'Nomina'),
```
Replace it with just:
```sql
('E-23', 'Gasto', 'Nomina'),
```

- [ ] **Step 4: Re-run the migration and verify it succeeds**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -i dwh-migrations/0017_dim_expense_concept.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "EXEC dwh.Load_Dim_ExpenseConcept;"
```

Expected: both commands succeed with no errors.

- [ ] **Step 5: Live-verify classification coverage and completeness**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT ConceptType, Category, COUNT(*) AS Cnt FROM dim.Dim_ExpenseConcept GROUP BY ConceptType, Category ORDER BY ConceptType, Category;
SELECT COUNT(*) AS TotalRows FROM dim.Dim_ExpenseConcept;
SELECT ConceptCode, ConceptName FROM dim.Dim_ExpenseConcept WHERE ConceptCode = 'BANCO';
" -W -s"|"
```

Expected: `TotalRows` = 248 (matching the live `saCuentaIngEgr` row count verified during brainstorming — re-verify this count is still 248 against the live source; if it has changed, some new/removed concepts exist and the seed's coverage should be spot-checked against the new list, not assumed still complete). The `BANCO` row must show `Category = 'Otros'`, not `'Traspaso'` — this is the one flagged-for-human-review row (spec §1.6); report it explicitly to the user, don't silently treat it as resolved. No `Category` should be NULL for any `ConceptType = 'Gasto'` row.

- [ ] **Step 6: Commit**

```bash
git add dwh-migrations/0017_dim_expense_concept.sql
git commit -m "$(cat <<'EOF'
feat: add Dim_ExpenseConcept with full concept classification

Classifies all 248 saCuentaIngEgr income/expense concepts into a fixed
category taxonomy (Nomina, MateriaPrima, Alquileres, Servicios,
Mantenimiento, Publicidad, Honorarios, Intereses, Impuestos, Otros),
and separates real expenses from income/transfer concepts that must
never enter Fact_Expenses.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `Fact_Expenses` fact table and ETL

**Files:**
- Create: `dwh-migrations/0018_fact_expenses.sql`

**Interfaces:**
- Consumes: `dim.Dim_ExpenseConcept` (Task 1) — joins on `ConceptCode`.
- Produces: `fact.Fact_Expenses` table (`ExpenseKey`, `DateKey`, `ExpenseConceptKey`, `Amount`, `SourceTable`, `IsVoided`, `LoadedAtUtc`) and `dwh.Load_Fact_Expenses` procedure. Task 4 (Finanzas route) queries this table.

- [ ] **Step 1: Write the migration file**

Create `dwh-migrations/0018_fact_expenses.sql`:

```sql
-- Sources fact.Fact_Expenses from saMovimientoBanco UNION saMovimientoCaja,
-- joined to dim.Dim_ExpenseConcept, EXCLUDING rows whose concept is
-- ConceptType 'Ingreso' or 'Traspaso' (see 0017_dim_expense_concept.sql and
-- spec docs/superpowers/specs/2026-09-12-finanzas-compras-design.md section
-- 1.4) — Fact_Expenses only ever contains real expenses, so no consumer of
-- this table needs to remember to filter ConceptType itself.
--
-- IMPORTANT: saMovimientoCaja is NOT a minor/edge-case source to skip if
-- short on time. Per the user (2026-09-12): it is actively used to register
-- payments manually when the main app fails to register them through the
-- bank movement flow — real payments exist ONLY in this table and nowhere
-- else. Both UNION branches below are required; do not simplify this to
-- saMovimientoBanco alone.
--
-- Grain: one row per bank/cash movement (matches source grain exactly, no
-- aggregation at load time).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Expenses' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Expenses (
        ExpenseKey        bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey           int             NOT NULL,
        ExpenseConceptKey int             NOT NULL,
        Amount            decimal(18,2)   NOT NULL,
        SourceTable       varchar(20)     NOT NULL,
        SourceMovNum      char(20)        NOT NULL,
        IsVoided          bit             NOT NULL,
        LoadedAtUtc       datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Expenses_Source UNIQUE (SourceTable, SourceMovNum),
        CONSTRAINT FK_Fact_Expenses_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Expenses_Dim_ExpenseConcept FOREIGN KEY (ExpenseConceptKey) REFERENCES dim.Dim_ExpenseConcept(ExpenseConceptKey)
    );
    CREATE INDEX IX_Fact_Expenses_DateKey ON fact.Fact_Expenses (DateKey);
    CREATE INDEX IX_Fact_Expenses_ExpenseConceptKey ON fact.Fact_Expenses (ExpenseConceptKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoBanco')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saMovimientoBanco', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoCaja')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saMovimientoCaja', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Expenses
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @BancoWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoBanco');
    DECLARE @CajaWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saMovimientoCaja');
    DECLARE @NewBancoWatermark binary(8);
    DECLARE @NewCajaWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            'Banco' AS SourceTable, RTRIM(m.mov_num) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoBanco m
        WHERE m.validador > @BancoWatermark
        UNION ALL
        SELECT
            'Caja' AS SourceTable, RTRIM(m.mov_num) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoCaja m
        WHERE m.validador > @CajaWatermark
    )
    MERGE fact.Fact_Expenses AS tgt
    USING (
        SELECT
            dk.DateKey, c.SourceTable, c.mov_num, ec.ExpenseConceptKey, c.Amount, c.anulado
        FROM Changed c
        JOIN dim.Dim_ExpenseConcept ec ON ec.ConceptCode = RTRIM(c.co_cta_ingr_egr) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fecha, 'yyyyMMdd')) AS DateKey) dk
        WHERE ec.ConceptType = 'Gasto'
    ) AS src
        ON tgt.SourceTable = src.SourceTable AND tgt.SourceMovNum = src.mov_num COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.ExpenseConceptKey = src.ExpenseConceptKey,
        tgt.Amount = src.Amount,
        tgt.IsVoided = src.anulado,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, ExpenseConceptKey, Amount, SourceTable, SourceMovNum, IsVoided)
        VALUES (src.DateKey, src.ExpenseConceptKey, src.Amount, src.SourceTable, src.mov_num, src.anulado);

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewBancoWatermark = ISNULL(MAX(validador), @BancoWatermark) FROM Ncake_a.dbo.saMovimientoBanco;
    SELECT @NewCajaWatermark = ISNULL(MAX(validador), @CajaWatermark) FROM Ncake_a.dbo.saMovimientoCaja;

    UPDATE dwh.EtlWatermark SET LastValidador = @NewBancoWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount WHERE SourceTableName = 'saMovimientoBanco';
    UPDATE dwh.EtlWatermark SET LastValidador = @NewCajaWatermark, LastRunAtUtc = SYSUTCDATETIME() WHERE SourceTableName = 'saMovimientoCaja';
END
GO
```

Note on `SourceMovNum` uniqueness: `mov_num` is only unique *within* `saMovimientoBanco` or *within* `saMovimientoCaja` individually (Profit Plus numbers each table's movements independently) — the `UNIQUE (SourceTable, SourceMovNum)` constraint and the MERGE's `ON tgt.SourceTable = src.SourceTable AND tgt.SourceMovNum = src.mov_num` condition both account for this by keying on the pair, not `mov_num` alone. Verify this assumption live in Step 3 below before trusting it.

- [ ] **Step 2: Run the migration against the live dev DWH**

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -i dwh-migrations/0018_fact_expenses.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "EXEC dwh.Load_Fact_Expenses;"
```

Expected: both succeed with no errors.

- [ ] **Step 3: Verify the mov_num uniqueness assumption and overall row counts live**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d Ncake_a -Q "
SELECT COUNT(*) AS Total, COUNT(DISTINCT mov_num) AS DistinctMovNum FROM saMovimientoBanco;
SELECT COUNT(*) AS Total, COUNT(DISTINCT mov_num) AS DistinctMovNum FROM saMovimientoCaja;
" -W -s"|"
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT SourceTable, COUNT(*) AS Cnt, SUM(Amount) AS TotalAmount FROM fact.Fact_Expenses WHERE IsVoided = 0 GROUP BY SourceTable;
" -W -s"|"
```

Expected: `Total = DistinctMovNum` for both source tables (confirms `mov_num` really is unique per-table, validating the MERGE key). `Fact_Expenses` row counts should be somewhat less than the raw source counts (Ingreso/Traspaso rows and unmatched concept codes are excluded) but in the same order of magnitude — if the count is drastically smaller (e.g. under 50% of source rows), investigate before proceeding; it likely means the `Dim_ExpenseConcept` join is failing for many codes (check for a collation or trimming mismatch first).

If `DistinctMovNum` is LESS than `Total` for either table (meaning `mov_num` is NOT unique per-table, contradicting this task's assumption), STOP and report this to the user rather than proceeding — the `UNIQUE (SourceTable, SourceMovNum)` constraint and MERGE key both need rethinking (likely composite with `fecha` or a different natural key), which is an architecture change big enough to warrant a design conversation, not a silent workaround.

Then specifically confirm `saMovimientoCaja` rows actually made it into `Fact_Expenses` — this is not optional cross-checking, it's the whole point of unioning that source (per the user, 2026-09-12: `saMovimientoCaja` captures real payments that failed to register through the bank flow and exist nowhere else):

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT COUNT(*) AS CajaRowsInFactExpenses FROM fact.Fact_Expenses WHERE SourceTable = 'Caja';
" -W -s"|"
```

Expected: a non-zero count (roughly proportional to `saMovimientoCaja`'s real row count minus any Ingreso/Traspaso/unmatched-concept rows — cross-check against the 64-row total found live during brainstorming, re-verifying that count is still current). If this is zero, the UNION ALL branch for `saMovimientoCaja` is broken (e.g. a bad join condition or a WHERE clause silently excluding everything) — do not proceed to Task 3 until this shows real data, since a zero here means real payments are being silently dropped from every expense report this feature produces.

- [ ] **Step 4: Cross-check a known category total against the brainstorming session's spot-check**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT ec.Category, SUM(fe.Amount) AS TotalAmount, COUNT(*) AS Cnt
FROM fact.Fact_Expenses fe
JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
WHERE fe.IsVoided = 0 AND fe.DateKey >= 20260101
GROUP BY ec.Category
ORDER BY TotalAmount DESC;
" -W -s"|"
```

Expected: `MateriaPrima` and `Nomina` should be among the largest categories (the brainstorming session found "Materia Prima" ~4.8M and "Nómina por Pagar" ~2.6M as the top two individual *concepts* in 2026 — the category totals should be at least that large, since a category aggregates multiple concepts). If the numbers are wildly different or a category that should have data is missing/zero, investigate the classification mapping in Task 1 before proceeding.

- [ ] **Step 5: Add to the incremental load script**

Modify `scripts/dwh-incremental-load.ts` — add both new procedures to `INCREMENTAL_LOAD`, `Load_Dim_ExpenseConcept` before `Load_Fact_Expenses` (dependency order, matching how `Load_Dim_Customer` precedes `Load_Fact_Sales`):

```ts
const INCREMENTAL_LOAD = `
EXEC dwh.Load_Dim_Currency;
EXEC dwh.Load_Fact_ExchangeRate;
EXEC dwh.Load_Dim_Customer;
EXEC dwh.Load_Dim_LegalEntity;
EXEC dwh.Load_Dim_Product;
EXEC dwh.Load_Dim_SalesRep;
EXEC dwh.Load_Dim_Warehouse;
EXEC dwh.Load_Dim_ExpenseConcept;
EXEC dwh.Load_Fact_Sales;
EXEC dwh.Load_Fact_Returns;
EXEC dwh.Load_Fact_Collections;
EXEC dwh.Load_Fact_Expenses;
`;
```

- [ ] **Step 6: Add SQL Agent jobsteps — CRITICAL, do not skip**

The prior legal-entity-grouping project shipped without this step initially and it was found as a **Critical** whole-branch-review finding: a procedure that exists but has no jobstep silently never runs once the job is enabled in production. Create `dwh-migrations/0019_add_expense_jobsteps.sql`:

```sql
-- Adds Load_Dim_ExpenseConcept and Load_Fact_Expenses as new steps at the
-- END of the existing 'DWH - Incremental Load' job (after whatever the
-- current last step is — Load_Fact_Collections in every scenario as of
-- 2026-09-12), then sets @on_success_action = 3 (go to next step) on the
-- FORMER last step and on Load_Dim_ExpenseConcept, leaving the true new
-- last step (Load_Fact_Expenses) at @on_success_action = 1 (quit reporting
-- success) — same fix pattern as 0016_fix_jobstep_success_action.sql, but
-- targeted at just the steps this migration touches rather than a full
-- dynamic re-normalization (0016 already normalized every step that existed
-- at the time it ran; this migration only needs to handle the NEW steps it
-- adds and the one existing step whose on_success_action must change from
-- 1 to 3 now that something follows it).
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load')
BEGIN
    DECLARE @job_id UNIQUEIDENTIFIER = (SELECT job_id FROM msdb.dbo.sysjobs WHERE name = N'DWH - Incremental Load');
    DECLARE @max_step_id INT = (SELECT MAX(step_id) FROM msdb.dbo.sysjobsteps WHERE job_id = @job_id);
    DECLARE @concept_step_id INT = @max_step_id + 1;
    DECLARE @expense_step_id INT = @max_step_id + 2;

    -- The step that was previously last must now continue to the next step.
    EXEC msdb.dbo.sp_update_jobstep @job_id = @job_id, @step_id = @max_step_id, @on_success_action = 3;

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Dim_ExpenseConcept')
    BEGIN
        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @concept_step_id,
            @step_name = N'Load_Dim_ExpenseConcept',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Dim_ExpenseConcept;',
            @on_success_action = 3;
    END

    IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobsteps js WHERE js.job_id = @job_id AND js.step_name = N'Load_Fact_Expenses')
    BEGIN
        EXEC msdb.dbo.sp_add_jobstep
            @job_id = @job_id,
            @step_id = @expense_step_id,
            @step_name = N'Load_Fact_Expenses',
            @subsystem = N'TSQL',
            @database_name = N'DWH_AlimentosNY',
            @command = N'EXEC dwh.Load_Fact_Expenses;',
            @on_success_action = 1;
    END
END
GO
```

- [ ] **Step 7: Run the jobstep migration and verify live**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -i dwh-migrations/0019_add_expense_jobsteps.sql
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -Q "
SELECT js.step_id, js.step_name, js.on_success_action
FROM msdb.dbo.sysjobsteps js JOIN msdb.dbo.sysjobs j ON j.job_id = js.job_id
WHERE j.name = 'DWH - Incremental Load' ORDER BY js.step_id;
" -W -s"|"
```

Expected: two new rows at the end (`Load_Dim_ExpenseConcept`, `Load_Fact_Expenses`), every step except the final one has `on_success_action = 3`, and the final step (`Load_Fact_Expenses`) has `on_success_action = 1`. Run this exact check — do not assume it worked from the migration succeeding without errors alone (matching the standard this project already holds itself to: live-verify jobstep chaining, don't just trust the script ran).

- [ ] **Step 8: Commit**

```bash
git add dwh-migrations/0018_fact_expenses.sql dwh-migrations/0019_add_expense_jobsteps.sql scripts/dwh-incremental-load.ts
git commit -m "$(cat <<'EOF'
feat: add Fact_Expenses ETL from bank/cash movements

Sources fact.Fact_Expenses from saMovimientoBanco + saMovimientoCaja,
watermark-incremental like Fact_Sales, excluding Ingreso/Traspaso
concepts at load time so every consumer sees only real expenses.
Wires both new procedures into the incremental load script and the
SQL Agent job (including on_success_action chaining) so this doesn't
repeat the Critical finding from the legal-entity-grouping project.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend `FinanzasResponse` type and waterfall calculation

**Files:**
- Modify: `app/(app)/analitica/types.ts`
- Modify: `app/api/dwh/finanzas/route.ts`
- Test: manual live verification (this route has no existing unit test file — matches the rest of the `app/api/dwh/*` routes, which are verified via live DB queries and E2E, not unit tests)

**Interfaces:**
- Consumes: `fact.Fact_Expenses` + `dim.Dim_ExpenseConcept` (Tasks 1-2).
- Produces: `FinanzasResponse` with `ebitda: number`, `intereses: number`, `impuestos: number`, `utilidadNeta: number`, `expenseBreakdown: { category: string; amount: number }[]`. Task 4 (tab) consumes this shape directly; Task 5 (breakdown drilldown) adds the `breakdownBy`/`parentValue` query-param path this route must also support.

- [ ] **Step 1: Read the current Finanzas route and type**

Before editing, read `app/api/dwh/finanzas/route.ts` and the existing `FinanzasResponse`/`FinanzasWaterfallStep` types in `app/(app)/analitica/types.ts` in full — this task extends existing logic, it doesn't replace it. Do not guess at the existing waterfall's exact query shape; copy its actual `WHERE`/`GROUP BY` date-range handling pattern (`buildDateWhereClause`) so the new expense steps use the identical date filter as the existing sales-based steps.

- [ ] **Step 2: Extend the `FinanzasResponse` type**

In `app/(app)/analitica/types.ts`, locate the existing `FinanzasResponse`/`FinanzasWaterfallStep` interfaces and extend `FinanzasResponse`:

```ts
export interface ExpenseCategoryRow {
  category: string;
  amount: number;
}

export interface FinanzasResponse {
  waterfall: FinanzasWaterfallStep[];
  ebitda: number;
  intereses: number;
  impuestos: number;
  utilidadNeta: number;
  expenseBreakdown: ExpenseCategoryRow[];
  usdRate: number | null;
}
```

(Keep the existing `FinanzasWaterfallStep` interface unchanged — the waterfall array itself just grows more entries, as shown in Step 4 below.)

- [ ] **Step 3: Write a live SQL query for expense totals by category**

Verify this query directly against the dev DWH before wiring it into the route:

```bash
export $(grep -E "^DB_" .env.local | xargs)
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
FROM fact.Fact_Expenses fe
JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
WHERE fe.IsVoided = 0 AND fe.DateKey >= CONVERT(INT, FORMAT(DATEADD(DAY, -365, GETDATE()), 'yyyyMMdd'))
GROUP BY ec.Category
ORDER BY TotalAmount DESC;
" -W -s"|"
```

Expected: rows for each of the 8 non-excluded categories that have data (Nomina, MateriaPrima, Alquileres, Servicios, Mantenimiento, Publicidad, Honorarios, Otros — Intereses/Impuestos are queried separately in Step 4, not part of this breakdown table since they're informational-only per the spec, not part of "Gastos Operativos").

- [ ] **Step 4: Add the expense/EBITDA queries to the route**

In `app/api/dwh/finanzas/route.ts`, add a function alongside the existing waterfall-building code (match the file's existing style — if it builds SQL via template-literal functions like `ventas/route.ts` does, follow that same pattern):

```ts
function expenseCategoryQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category NOT IN ('Intereses', 'Impuestos') ${dateWhere}
    GROUP BY ec.Category
    ORDER BY TotalAmount DESC
  `;
}

function excludedExpenseQuery(dateWhere: string): string {
  return `
    SELECT ec.Category, SUM(fe.Amount) AS TotalAmount
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category IN ('Intereses', 'Impuestos') ${dateWhere}
    GROUP BY ec.Category
  `;
}
```

Use `buildDateWhereClause(dateRange, 'fe')` (imported from `../lib/query-builder`, same as every other route) to build `dateWhere` — this makes the expense date filter respect the same `dateRange`/custom-range param as the rest of the tab, including the custom date range feature added 2026-09-12.

- [ ] **Step 5: Wire the queries into the GET handler and compute the waterfall**

In the route's `GET` handler, after the existing sales-based waterfall computation (`Ventas Netas`, `COGS`, `Utilidad Bruta` — read the exact existing variable names from the file rather than guessing them), add:

```ts
const [categoryResult, excludedResult] = await Promise.all([
  pool.request().query(expenseCategoryQuery(dateWhere)),
  pool.request().query(excludedExpenseQuery(dateWhere)),
]);

const expenseBreakdown: ExpenseCategoryRow[] = categoryResult.recordset.map(r => ({
  category: String(r.Category),
  amount: Number(r.TotalAmount),
}));

const gastosOperativos = expenseBreakdown.reduce((sum, row) => sum + row.amount, 0);
const intereses = Number(excludedResult.recordset.find(r => r.Category === 'Intereses')?.TotalAmount ?? 0);
const impuestos = Number(excludedResult.recordset.find(r => r.Category === 'Impuestos')?.TotalAmount ?? 0);

// utilidadBruta must be the existing waterfall's own "Utilidad Bruta" value —
// read it from whatever variable the existing code already computes; do not
// recompute it here.
const ebitda = utilidadBruta - gastosOperativos;
const utilidadNeta = ebitda - intereses - impuestos;
```

Then extend the existing `waterfall` array (append after the existing steps, following whatever cumulative-tracking pattern the existing steps already use — e.g. if existing steps carry a running `cumulative` field, `EBITDA`'s cumulative is `ebitda`, `Utilidad Neta`'s is `utilidadNeta`):

```ts
waterfall.push(
  { step: 'Gastos Operativos', amount: -gastosOperativos, cumulative: ebitda },
  { step: 'EBITDA (aprox.)', amount: 0, cumulative: ebitda },
  { step: 'Intereses', amount: -intereses, cumulative: ebitda - intereses },
  { step: 'Impuestos', amount: -impuestos, cumulative: utilidadNeta },
  { step: 'Utilidad Neta', amount: 0, cumulative: utilidadNeta },
);
```

(The exact field names/shape of `FinanzasWaterfallStep` must match what Step 1's reading found — this code assumes `{ step, amount, cumulative }` per the spec's original waterfall description; adjust to the real interface if it differs, but do not change the interface itself without checking what the tab component currently reads from it.)

Include `ebitda`, `intereses`, `impuestos`, `utilidadNeta`, `expenseBreakdown` in the final `NextResponse.json(...)` response object.

- [ ] **Step 6: Live-verify the full route response**

Start the dev server if not already running, log in, and hit the route directly (or verify via `curl` with a valid session cookie — check how other routes in this codebase are manually smoke-tested, e.g. via the E2E fixtures' login pattern, and use the same approach). At minimum, verify via direct SQL that `ebitda`/`utilidadNeta` arithmetic is sane:

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT
  (SELECT ISNULL(SUM(NetAmount),0) FROM fact.Fact_Sales WHERE IsVoided = 0) AS VentasNetas,
  (SELECT ISNULL(SUM(fe.Amount),0) FROM fact.Fact_Expenses fe JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey WHERE fe.IsVoided = 0 AND ec.Category NOT IN ('Intereses','Impuestos')) AS GastosOperativos,
  (SELECT ISNULL(SUM(fe.Amount),0) FROM fact.Fact_Expenses fe JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey WHERE fe.IsVoided = 0 AND ec.Category = 'Intereses') AS Intereses,
  (SELECT ISNULL(SUM(fe.Amount),0) FROM fact.Fact_Expenses fe JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey WHERE fe.IsVoided = 0 AND ec.Category = 'Impuestos') AS Impuestos;
" -W -s"|"
```

Compute EBITDA/Utilidad Neta by hand from this output and compare against what the route returns — they must match exactly (within the date-range filter both use).

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/analitica/types.ts app/api/dwh/finanzas/route.ts
git commit -m "$(cat <<'EOF'
feat: add EBITDA, Utilidad Neta, and expense breakdown to Finanzas API

Extends the existing sales-only waterfall with real operating
expenses from Fact_Expenses: Gastos Operativos, EBITDA (excl.
Intereses/Impuestos, labeled as an approximation since D&A is
structurally unavailable), and Utilidad Neta.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Expense category breakdown drilldown (concept-level detail)

**Files:**
- Modify: `app/api/dwh/finanzas/route.ts`

**Interfaces:**
- Consumes: `dim.Dim_ExpenseConcept.Category`/`ConceptName` (Task 1).
- Produces: a `breakdownBy=concepto&parentValue=<category>` query-param path on the Finanzas route, returning `{ breakdown: BreakdownRow[] }` matching the shape `GroupedDrilldownTable` (Task 5) expects — same contract as every other tab's breakdown fetch (e.g. `app/api/dwh/vendedores/route.ts`'s `breakdownQuery`).

- [ ] **Step 1: Add a concept-level breakdown query**

In `app/api/dwh/finanzas/route.ts`, add:

```ts
function conceptBreakdownQuery(dateWhere: string): string {
  return `
    SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, SUM(fe.Amount) AS Amount
    FROM fact.Fact_Expenses fe
    JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
    WHERE fe.IsVoided = 0 AND ec.Category = @category ${dateWhere}
    GROUP BY ec.ConceptName, ec.ConceptCode
    ORDER BY Amount DESC
  `;
}
```

- [ ] **Step 2: Wire a `breakdownBy`/`parentValue` branch into the GET handler**

Near the top of the `GET` handler (before the main waterfall query runs — matching the early-return pattern every other tab's route already uses for its breakdown path, e.g. `ventas/route.ts`'s `if (breakdownBy && parentValue) { ... }` block), add:

```ts
const breakdownByParam = searchParams.get('breakdownBy');
const parentValue = searchParams.get('parentValue');

if (breakdownByParam === 'concepto' && parentValue) {
  const req = pool.request();
  req.input('category', parentValue);
  const result = await req.query(conceptBreakdownQuery(dateWhere));
  return NextResponse.json({
    breakdown: result.recordset.map(r => ({ label: r.GroupLabel, value: String(r.GroupValue), amount: Number(r.Amount) })),
  });
}
```

(`dateWhere` here must be computed the same way as Task 3's Step 4 — reuse the same `buildDateWhereClause(dateRange, 'fe')` call already added there; don't duplicate a differently-named variable.)

- [ ] **Step 3: Live-verify the breakdown query**

```bash
sqlcmd -S "$DB_SERVER,$DB_PORT" -U "$DB_USER" -P "$DB_PASSWORD" -C -d DWH_AlimentosNY -Q "
SELECT TOP 15 ec.ConceptName AS GroupLabel, ec.ConceptCode AS GroupValue, SUM(fe.Amount) AS Amount
FROM fact.Fact_Expenses fe
JOIN dim.Dim_ExpenseConcept ec ON ec.ExpenseConceptKey = fe.ExpenseConceptKey
WHERE fe.IsVoided = 0 AND ec.Category = 'Nomina'
GROUP BY ec.ConceptName, ec.ConceptCode
ORDER BY Amount DESC;
" -W -s"|"
```

Expected: a ranked list of payroll-related concept names (Sueldos, Bono Vacacional, Prestaciones Sociales, etc.) with real amounts — sanity-check against the concept names visible in Task 1's seed data for the `Nomina` category.

- [ ] **Step 4: Commit**

```bash
git add app/api/dwh/finanzas/route.ts
git commit -m "$(cat <<'EOF'
feat: add concept-level breakdown to Finanzas expense categories

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Finanzas tab UI — extended waterfall and expense breakdown table

**Files:**
- Modify: `app/(app)/analitica/tabs/tab-finanzas.tsx`
- Modify: `e2e/analitica.spec.ts`

**Interfaces:**
- Consumes: `FinanzasResponse` (Task 3), the concept breakdown endpoint (Task 4), the shared `GroupedDrilldownTable` component (`app/(app)/analitica/components/grouped-drilldown-table.tsx` — already exists from the 2026-09-10 project, not created by this plan).

- [ ] **Step 1: Read the current tab-finanzas.tsx in full**

Before editing, read the entire file — this task extends the existing waterfall rendering, it does not replace it. Note the existing `money`/`moneyLabel` helper functions (every tab in this codebase defines its own copy rather than sharing one, per the existing pattern in `tab-ventas.tsx`/`tab-vendedores.tsx` — follow that same local-helper convention here, don't introduce a shared import unless one already exists).

- [ ] **Step 2: Render the extended waterfall**

The existing waterfall rendering (whatever chart/table component it currently uses — read this from the file before assuming a specific library) should render the new steps (`Gastos Operativos`, `EBITDA (aprox.)`, `Intereses`, `Impuestos`, `Utilidad Neta`) automatically once `FinanzasResponse.waterfall` includes them, IF the existing rendering code maps over the array generically rather than hardcoding 4-5 named steps. Verify which is true by reading the render code; if it hardcodes step names/positions, extend it to render the new steps too, following the exact same JSX/styling pattern as the existing ones (don't introduce a different visual style for the new steps).

Add an `EBITDA (aprox.)` label with a `title` tooltip attribute (matching the pattern already used for the "Tasa cobr." tooltip in `tab-vendedores.tsx`, added 2026-09-10): `title="Ganancias antes de intereses e impuestos. No incluye ajuste por depreciación/amortización — no disponible en los datos de movimientos bancarios."`

- [ ] **Step 3: Add the expense category breakdown table**

Below the waterfall, add a `GroupedDrilldownTable` instance following the exact pattern from `tab-vendedores.tsx` (which has no top-level groupBy toggle either — same "fixed single no-op groupBy option" shape):

```tsx
const CATEGORY_GROUP_BY_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Categoría' },
];

const CATEGORY_BREAKDOWN_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: 'producto', label: 'Concepto' },
];
```

Note: `PivotDimension` (from `../types`) is `'cliente_entidad' | 'cliente_tienda' | 'producto' | 'vendedor'` — none of these values are semantically "category" or "concepto". Reusing `'producto'` as a sentinel (as Task 2 of the Ventas-línea-breakdown fix did for the línea→producto path on 2026-09-12) works but is a slight abuse of the type. Do NOT add a new `PivotDimension` member for this — that type is shared by the generic Cliente/Producto/Vendedor pivot mechanism from the 2026-09-10 project and adding an unrelated `'categoria'` value to it would leak Finanzas-specific concerns into that shared contract. Instead, define the tab's own local row/breakdown types that don't route through `GroupedDrilldownTable`'s `groupBy`/`breakdownBy` machinery at all if a cleaner fit is needed — but for a first cut, the `'producto'`-sentinel approach (exactly mirroring the already-shipped línea→producto precedent) is acceptable and consistent with existing code.

```tsx
const [categoryBreakdownBy, setCategoryBreakdownBy] = useState<PivotDimension | null>(null);

async function handleFetchCategoryBreakdown(parentValue: string): Promise<BreakdownRow[]> {
  const params = new URLSearchParams({ dateRange, currency, breakdownBy: 'concepto', parentValue });
  const res = await fetch(`/api/dwh/finanzas?${params.toString()}`);
  if (!res.ok) return [];
  const body: { breakdown?: BreakdownRow[] } = await res.json().catch(() => ({}));
  return body.breakdown ?? [];
}

const categoryRows = (data?.expenseBreakdown ?? []).map(row => ({
  label: row.category,
  value: row.category,
  amount: row.amount,
}));

const categoryColumns: DrilldownColumn<typeof categoryRows[number]>[] = [
  { key: 'amount', label: 'Monto', align: 'right', format: row => moneyLabel(row.amount, currency, rate) },
];
```

```tsx
<GroupedDrilldownTable
  rows={categoryRows}
  columns={categoryColumns}
  groupByOptions={CATEGORY_GROUP_BY_OPTIONS}
  groupBy="producto"
  onGroupByChange={() => {}}
  breakdownByOptions={CATEGORY_BREAKDOWN_OPTIONS}
  breakdownBy={categoryBreakdownBy}
  onBreakdownByChange={setCategoryBreakdownBy}
  onFetchBreakdown={handleFetchCategoryBreakdown}
  formatBreakdownMetric={(_key, value) => (typeof value === 'number' ? moneyLabel(value, currency, rate) : String(value ?? '—'))}
/>
```

The `handleFetchCategoryBreakdown` signature here takes only `parentValue` (dropping the `dimension` parameter every other tab's fetch handler takes, since Finanzas only ever breaks down by concepto) — `GroupedDrilldownTable`'s `onFetchBreakdown` prop type is `(parentValue: string, breakdownBy: PivotDimension) => Promise<BreakdownRow[]>` (two params), so wrap it: pass `(parentValue: string) => handleFetchCategoryBreakdown(parentValue)` as the actual prop value, or change `handleFetchCategoryBreakdown` to accept and ignore the second param — check `grouped-drilldown-table.tsx`'s exact prop type before wiring this up and match it exactly; do not guess.

- [ ] **Step 4: Verify in the browser**

Run the dev server, log in, navigate to the Finanzas tab, and visually confirm: the waterfall shows the 5 new steps in order, EBITDA has a hover tooltip, the category breakdown table renders below it, and clicking a category row expands to concept-level detail. Toggle the currency selector and confirm both the waterfall and the breakdown table's amounts convert correctly (this is the exact bug class fixed 2026-09-11 — do not ship this without checking it works from the first render).

- [ ] **Step 5: Extend E2E coverage**

Read the existing `e2e/analitica.spec.ts` in full first — follow its exact structure (fixture usage, `@mssql` tag, assertion style) rather than inventing a new pattern. Add a test that navigates to the Finanzas tab, asserts the EBITDA/Utilidad Neta waterfall steps are visible, expands a category breakdown row, and asserts concept-level rows appear.

- [ ] **Step 6: Run the E2E suite**

```bash
bun run e2e:seed
bunx playwright test e2e/analitica.spec.ts --grep "Finanzas"
```

Expected: PASS. If `bun` resolves to a Node version below 20 (a known pre-existing local blocker per memory `e2e_playwright_suite_progress` — not something this task needs to fix), use `nvm use 20` first, matching how the 2026-09-10 project worked around the same issue.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/analitica/tabs/tab-finanzas.tsx e2e/analitica.spec.ts
git commit -m "$(cat <<'EOF'
feat: render EBITDA waterfall and expense breakdown in Finanzas tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Knowledge base metadata update

**Files (in the separate `erp-knowledge-base` repo, NOT this one):**
- Modify: `/Users/eugenio/repos/new-york-venezuela/erp-knowledge-base/docs/tables/saCuentaIngEgr.md`
- Modify: `/Users/eugenio/repos/new-york-venezuela/erp-knowledge-base/docs/tables/scCuenta.md`
- Modify: `/Users/eugenio/repos/new-york-venezuela/erp-knowledge-base/docs/tables/scGastos.md`
- Modify: `/Users/eugenio/repos/new-york-venezuela/erp-knowledge-base/docs/tables/scCentro.md`

**Interfaces:** none — this is documentation-only, does not affect any code in the `profitplus-exporter` repo. Independent of every other task in this plan; can be done in parallel with Tasks 1-5 by a separate subagent since there's no shared state.

**IMPORTANT**: this is a **separate git repository** at `/Users/eugenio/repos/new-york-venezuela/erp-knowledge-base` — commits here must NOT be mixed with `profitplus-exporter` commits, and this repo's own commit conventions should be checked (`git log` in that repo) before committing, since it may differ from `profitplus-exporter`'s.

- [ ] **Step 1: Read all four existing files and the repo's commit conventions**

```bash
cd /Users/eugenio/repos/new-york-venezuela/erp-knowledge-base
git log --oneline -10
```

Read `docs/tables/saCuentaIngEgr.md`, `docs/tables/scCuenta.md`, `docs/tables/scGastos.md`, `docs/tables/scCentro.md` in full, and read `docs/tables/saMovimientoBanco.md` as a reference for the target quality bar (it already has a proper "Descripción de Negocio" and a "Recetario SQL de Negocio" section — the four files this task touches currently say "_Pendiente de enriquecimiento_" and have raw Python-`repr()` byte-string artifacts like `b'C\xc3\xb3digo...'` in their field descriptions instead of clean text).

- [ ] **Step 2: Rewrite `saCuentaIngEgr.md`**

Replace the `_Pendiente de enriquecimiento_` line and clean up every `b'...'` field description. The business description must state (facts verified live 2026-09-12, safe to state as fact, not hedge):

```markdown
**Descripción de Negocio**: Catálogo de conceptos de ingreso/egreso usado por `saMovimientoBanco` y `saMovimientoCaja` para clasificar cada movimiento bancario/de caja. 248 conceptos activos (verificado en vivo 2026-09-12). El prefijo del código indica el tipo: `I-` = Ingreso (dinero entrante, ej. "I-01|Ventas"), numérico o `E-` = Egreso (gasto real), y un pequeño grupo (`TRASP`, `E-12`, `I-08`) son traspasos entre cuentas propias de la empresa — ninguno de estos tres representa actividad económica real y deben excluirse de cualquier reporte de gastos o ingresos reales. Cobertura de join verificada: 100% de los movimientos no anulados en `saMovimientoBanco` (12,449/12,449) y `saMovimientoCaja` (64/64) resuelven a un concepto de esta tabla (unir por `LTRIM(RTRIM(co_cta_ingr_egr))` en ambos lados — el código es `char` de ancho fijo).
```

Then clean each field's `Descripción` column from the raw `b'...'` byte-string format to normal readable Spanish text (decode the visible UTF-8 escapes, e.g. `b'C\xc3\xb3digo de la cuenta...'` → `Código de la cuenta...` — these are literal mojibake from an unclosed Python `repr()` call somewhere in this KB's original generation tooling, not intentional formatting).

- [ ] **Step 3: Rewrite `scCuenta.md`**

Add the business description (facts verified live 2026-09-12):

```markdown
**Descripción de Negocio**: Catálogo de cuentas contables (347 cuentas activas, verificado en vivo 2026-09-12). El primer dígito del código (`co_cue`) indica la categoría contable estándar venezolana: `1`=Activo, `2`=Pasivo, `3`=Patrimonio, `4`=Ingresos, `5`=Costo de Venta, `6`=Gastos Operativos (confirmado por muestreo: cuentas 5xx incluyen "Costo de Venta Materia Prima"/"Descuentos en compras"; cuentas 6xx incluyen "Sueldos Administrativos"/"Bono Vacacional"). **Importante**: el mecanismo de clasificación previsto originalmente para esta tabla — el flag `cue_gasto` y el campo `co_gas` (FK a `scGastos`) — está completamente vacío en los datos verificados: `cue_gasto = 0` en las 347 filas, `co_gas` vacío en las 347 filas, y `scGastos` tiene 0 filas. Para análisis de gastos reales, usar `saMovimientoBanco`/`saMovimientoCaja` + `saCuentaIngEgr` en su lugar (ver `saCuentaIngEgr.md`) — esa ruta tiene cobertura completa y datos multi-año (2021-2026), mientras que esta tabla sirve principalmente para la jerarquía de cuentas (`centro_co`, `co_cuepadre`, ambos poblados en el 100% de las filas) y no para clasificación gasto/ingreso.
```

Clean the `b'...'` byte-string artifacts from every field's description, same as Step 2.

- [ ] **Step 4: Rewrite `scGastos.md`**

```markdown
**Descripción de Negocio**: Catálogo de cuentas de gasto, pensado como el destino de `scCuenta.co_gas`. **Verificado vacío en vivo 2026-09-12**: 0 filas en esta tabla, y `scCuenta.co_gas` no apunta a ninguna fila aquí en ninguna de las 347 cuentas contables existentes. Esta tabla y su relación con `scCuenta` no están en uso en los datos actuales — no depender de esta ruta para clasificación de gastos. Ver `saCuentaIngEgr.md` para el catálogo de conceptos que sí está poblado y en uso real.
```

Clean the `b'...'` byte-string artifacts.

- [ ] **Step 5: Rewrite `scCentro.md`**

```markdown
**Descripción de Negocio**: Catálogo de centros de costo (6 centros activos, verificado en vivo 2026-09-12: ADM/Administración y Finanzas, INV/Inversiones y Desarrollo, PPAN/Producción Panadería, PPAST/Producción Pastelería, PROD/Producción, VENT/Ventas y Distribución). `scCuenta.centro_co` referencia esta tabla y está poblado en el 100% de las 347 cuentas contables. **Nota de integración**: el código de centro de costo aquí (alfabético, ej. "ADM") usa un espacio de códigos completamente distinto al de `saMovimientoBanco.co_cta_ingr_egr` (numérico/`E-`/`I-`, ej. "119") — no son directamente comparables ni unibles entre sí sin pasar por `scCuenta`. Un desglose de gastos por centro de costo (si se necesita en el futuro) requeriría investigar `saMovimientoBanco.dis_cen` (columna XML, no verificada en vivo a la fecha de esta nota) en lugar de intentar unir estas dos tablas directamente.
```

Clean the `b'...'` byte-string artifacts.

- [ ] **Step 6: Commit in the erp-knowledge-base repo**

```bash
cd /Users/eugenio/repos/new-york-venezuela/erp-knowledge-base
git add docs/tables/saCuentaIngEgr.md docs/tables/scCuenta.md docs/tables/scGastos.md docs/tables/scCentro.md
git commit -m "$(cat <<'EOF'
docs: enrich saCuentaIngEgr/scCuenta/scGastos/scCentro metadata

Adds real business descriptions verified live against the dev DWH
(row counts, join coverage, account-code category convention) and
fixes raw Python repr() byte-string artifacts in field descriptions.
Documents that scGastos/cue_gasto/co_gas are empty/unused in practice
— saCuentaIngEgr is the real, populated expense-classification path.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Do not push this commit unless the user explicitly asks — matches the standing policy on all commits in this project.

---

## Final Task: Full regression pass

**Files:** none new — this task runs existing verification across everything Tasks 1-6 touched.

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/eugenio/repos/new-york-venezuela/profitplus-exporter
bun run tsc --noEmit -p .
```

Expected: no new errors beyond the pre-existing, unrelated `__tests__/integration/inventory-change-unit.integration.test.ts` failures (5 errors, present on `main` before this plan — confirmed via `git stash` comparison during the 2026-09-12 session; do not attempt to fix these, they are out of scope).

- [ ] **Step 2: Full E2E suite**

```bash
bun run e2e:seed
bunx playwright test e2e/analitica.spec.ts
```

Expected: PASS, including both the pre-existing tests and the new Finanzas coverage from Task 5.

- [ ] **Step 3: Re-run the full incremental load end-to-end**

```bash
bun run scripts/dwh-incremental-load.ts
```

Expected: succeeds with no errors, including the two new procedures added in this plan, in the correct order.

- [ ] **Step 4: Manual browser verification**

Start the dev server, log in, navigate through the full Finanzas tab: date-range changes (including a custom range), currency toggle, category breakdown expand/collapse. Confirm no console errors.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` for the full diff on this branch (`feature/finanzas-compras-facts`) once Tasks 1-6 are complete, before merging or opening a PR.
