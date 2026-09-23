-- Renames fact.Fact_Expenses -> fact.Fact_CashMovements and widens
-- Load_Fact_Expenses (recreated as Load_Fact_CashMovements) to also load
-- ConceptType = 'Ingreso' rows (previously excluded entirely to avoid
-- double-counting against Fact_Sales revenue -- Fact_Sales's revenue is not
-- usable for margin/EBITDA purposes since GrossProfitAmount is always NULL,
-- see docs/superpowers/specs/2026-09-14-cash-movement-ebitda-design.md).
-- Traspaso rows remain excluded (internal transfers, not real income or
-- expense).
--
-- Sign convention (verified live 2026-09-14): Amount = monto_d - monto_h.
-- Gasto rows net positive-as-expense (unchanged). Ingreso rows net negative
-- (I-01 Ventas: -65,957,202 over the verification window) since income
-- entries are credit-heavy. This migration does NOT flip the sign at load
-- time -- Fact_CashMovements.Amount keeps one consistent meaning ("debit
-- minus credit") for every row regardless of concept type. Consumers
-- (Finanzas API route) negate Ingreso-side sums themselves.
-- 0018_fact_expenses.sql declared the primary key inline
-- (`ExpenseKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY`), so SQL Server
-- assigned it an auto-generated name (e.g. PK__Fact_Exp__<hash>), not a
-- predictable literal like 'PK_Fact_Expenses' — it must be looked up via
-- sys.key_constraints rather than hard-coded. The unique constraint and both
-- foreign keys WERE explicitly named in 0018, so those rename directly.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Expenses' AND schema_id = SCHEMA_ID('fact'))
   AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_CashMovements' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    DECLARE @PkName sysname = (
        SELECT kc.name
        FROM sys.key_constraints kc
        WHERE kc.parent_object_id = OBJECT_ID('fact.Fact_Expenses') AND kc.type = 'PK'
    );
    DECLARE @RenameSql nvarchar(max);

    EXEC sp_rename 'fact.Fact_Expenses', 'Fact_CashMovements';

    IF @PkName IS NOT NULL
    BEGIN
        SET @RenameSql = N'EXEC sp_rename N''fact.' + @PkName + N''', N''PK_Fact_CashMovements'', N''OBJECT''';
        EXEC sp_executesql @RenameSql;
    END

    EXEC sp_rename 'fact.UQ_Fact_Expenses_Source', 'UQ_Fact_CashMovements_Source', 'OBJECT';
    EXEC sp_rename 'fact.FK_Fact_Expenses_Dim_Date', 'FK_Fact_CashMovements_Dim_Date', 'OBJECT';
    EXEC sp_rename 'fact.FK_Fact_Expenses_Dim_ExpenseConcept', 'FK_Fact_CashMovements_Dim_ExpenseConcept', 'OBJECT';
    -- Index rename requires 'table.index' (not 'schema.index') as the first argument.
    EXEC sp_rename 'fact.Fact_CashMovements.IX_Fact_Expenses_DateKey', 'IX_Fact_CashMovements_DateKey', 'INDEX';
    EXEC sp_rename 'fact.Fact_CashMovements.IX_Fact_Expenses_ExpenseConceptKey', 'IX_Fact_CashMovements_ExpenseConceptKey', 'INDEX';
END
GO

-- Fresh-install path: if Fact_Expenses never existed on this DB (a brand new
-- DWH, e.g. a test database), create Fact_CashMovements directly instead of
-- renaming.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_CashMovements' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_CashMovements (
        ExpenseKey        bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Fact_CashMovements PRIMARY KEY,
        DateKey           int             NOT NULL,
        ExpenseConceptKey int             NOT NULL,
        Amount            decimal(18,2)   NOT NULL,
        SourceTable       varchar(20)     NOT NULL,
        SourceMovNum      char(20)        NOT NULL,
        IsVoided          bit             NOT NULL,
        LoadedAtUtc       datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_CashMovements_Source UNIQUE (SourceTable, SourceMovNum),
        CONSTRAINT FK_Fact_CashMovements_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_CashMovements_Dim_ExpenseConcept FOREIGN KEY (ExpenseConceptKey) REFERENCES dim.Dim_ExpenseConcept(ExpenseConceptKey)
    );
    CREATE INDEX IX_Fact_CashMovements_DateKey ON fact.Fact_CashMovements (DateKey);
    CREATE INDEX IX_Fact_CashMovements_ExpenseConceptKey ON fact.Fact_CashMovements (ExpenseConceptKey);
END
GO

-- Income classification: all 31 'I-' concept codes, verified live 2026-09-14
-- against Ncake_a.dbo.saCuentaIngEgr / saMovimientoBanco. I-01 Ventas is the
-- only one classified as operating revenue (dominates by volume, ~66M vs
-- low hundreds of thousands combined for everything else) -- see spec
-- section 3.2 for the full per-code rationale table. I-08 is already
-- ConceptType = 'Traspaso' in the existing 0017 seed and is untouched here.
--
-- MERGE against dim.ExpenseConceptSeed rather than a second INSERT block:
-- 0017's seed INSERT only ever wrote 'Ingreso' rows with Category = NULL
-- (see 0017_dim_expense_concept.sql's Ingresos/Impuestos-adjacent I- rows).
-- This MERGE updates those existing rows' Category in place instead of
-- inserting duplicates, and is itself idempotent (safe to re-run).
MERGE dim.ExpenseConceptSeed AS tgt
USING (VALUES
    ('I-01', 'VentasOperativas'),
    ('I-02', 'Otros'), ('I-03', 'Otros'), ('I-04', 'Otros'), ('I-05', 'Otros'),
    ('I-06', 'Otros'), ('I-07', 'Otros'), ('I-09', 'Otros'), ('I-10', 'Otros'),
    ('I-11', 'Otros'), ('I-12', 'Otros'), ('I-13', 'Otros'), ('I-14', 'Otros'),
    ('I-15', 'Otros'), ('I-16', 'Otros'), ('I-17', 'Otros'), ('I-18', 'Otros'),
    ('I-19', 'Otros'), ('I-20', 'Otros'), ('I-21', 'Otros'), ('I-22', 'Otros'),
    ('I-23', 'Otros'), ('I-24', 'Otros'), ('I-25', 'Otros'), ('I-26', 'Otros'),
    ('I-27', 'Otros'), ('I-28', 'Otros'), ('I-29', 'Otros'), ('I-30', 'Otros'),
    ('I-31', 'Otros'), ('I-32', 'Otros')
) AS src (ConceptCode, Category)
    ON tgt.ConceptCode = src.ConceptCode
WHEN MATCHED THEN UPDATE SET tgt.Category = src.Category;
GO

-- Widen Load_Dim_ExpenseConcept's IsExcludedFromEbitda derivation: the
-- original CASE only ever looked at Gasto-side categories (Intereses,
-- Impuestos). Every non-VentasOperativas Ingreso row must also be excluded
-- from EBITDA (loans, asset sales, interest income, receivables, FX, tax
-- pass-through -- see spec section 3.2), so this ORs in a second condition
-- rather than hand-flagging 30 individual seed rows.
CREATE OR ALTER PROCEDURE dwh.Load_Dim_ExpenseConcept
AS
BEGIN
    SET NOCOUNT ON;

    IF (SELECT COUNT(*) FROM dim.ExpenseConceptSeed) < 200
    BEGIN
        RAISERROR('Load_Dim_ExpenseConcept: dim.ExpenseConceptSeed has fewer than 200 rows (expected ~246). Aborting to avoid silently reclassifying all expense concepts to Otros/Gasto. Re-run the 0017_dim_expense_concept.sql seed INSERT to repopulate before retrying.', 16, 1);
        RETURN;
    END

    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCuentaIngEgr');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_ExpenseConcept AS tgt
    USING (
        SELECT
            LTRIM(RTRIM(src.co_cta_ingr_egr)) AS ConceptCode,
            RTRIM(src.descrip) AS ConceptName,
            ISNULL(seed.ConceptType, 'Gasto') AS ConceptType,
            ISNULL(seed.Category, 'Otros') AS Category,
            CASE
                WHEN seed.Category IN ('Intereses', 'Impuestos') THEN 1
                WHEN seed.ConceptType = 'Ingreso' AND ISNULL(seed.Category, 'Otros') <> 'VentasOperativas' THEN 1
                ELSE 0
            END AS IsExcludedFromEbitda
        FROM Ncake_a.dbo.saCuentaIngEgr src
        LEFT JOIN dim.ExpenseConceptSeed seed ON LTRIM(RTRIM(seed.ConceptCode)) = LTRIM(RTRIM(src.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
    ) AS src
        ON LTRIM(RTRIM(tgt.ConceptCode)) = LTRIM(RTRIM(src.ConceptCode)) COLLATE SQL_Latin1_General_CP1_CI_AS
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

-- Load_Fact_CashMovements: same MERGE body as the old Load_Fact_Expenses,
-- widened to ConceptType IN ('Gasto', 'Ingreso') and targeting the renamed
-- table. Old Load_Fact_Expenses is dropped -- nothing else references it
-- after Task 3/4/5 of this plan update every call site.
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'Load_Fact_Expenses' AND schema_id = SCHEMA_ID('dwh'))
    DROP PROCEDURE dwh.Load_Fact_Expenses;
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_CashMovements
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
            'Banco' AS SourceTable, LTRIM(RTRIM(m.mov_num)) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoBanco m
        WHERE m.validador > @BancoWatermark
        UNION ALL
        SELECT
            'Caja' AS SourceTable, LTRIM(RTRIM(m.mov_num)) AS mov_num, m.fecha, m.co_cta_ingr_egr,
            (ISNULL(m.monto_d, 0) - ISNULL(m.monto_h, 0)) AS Amount, ISNULL(m.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saMovimientoCaja m
        WHERE m.validador > @CajaWatermark
    )
    MERGE fact.Fact_CashMovements AS tgt
    USING (
        SELECT
            dk.DateKey, c.SourceTable, c.mov_num, ec.ExpenseConceptKey, c.Amount, c.anulado
        FROM Changed c
        JOIN dim.Dim_ExpenseConcept ec ON LTRIM(RTRIM(ec.ConceptCode)) = LTRIM(RTRIM(c.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fecha, 'yyyyMMdd')) AS DateKey) dk
        WHERE ec.ConceptType IN ('Gasto', 'Ingreso')
    ) AS src
        ON LTRIM(RTRIM(tgt.SourceTable)) = LTRIM(RTRIM(src.SourceTable)) AND LTRIM(RTRIM(tgt.SourceMovNum)) = LTRIM(RTRIM(src.mov_num)) COLLATE SQL_Latin1_General_CP1_CI_AS
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
