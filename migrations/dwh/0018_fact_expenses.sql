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
--
-- Global Constraint (per Task 1 review / this project's standing rule):
-- always LTRIM(RTRIM(...)) both sides of a join or comparison against
-- saMovimientoBanco/saMovimientoCaja/saCuentaIngEgr fixed-width char
-- columns (mov_num, co_cta_ingr_egr, etc.) — not bare RTRIM. Applied
-- throughout this migration's MERGE below, matching
-- 0017_dim_expense_concept.sql's Load_Dim_ExpenseConcept.
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
    MERGE fact.Fact_Expenses AS tgt
    USING (
        SELECT
            dk.DateKey, c.SourceTable, c.mov_num, ec.ExpenseConceptKey, c.Amount, c.anulado
        FROM Changed c
        JOIN dim.Dim_ExpenseConcept ec ON LTRIM(RTRIM(ec.ConceptCode)) = LTRIM(RTRIM(c.co_cta_ingr_egr)) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fecha, 'yyyyMMdd')) AS DateKey) dk
        WHERE ec.ConceptType = 'Gasto'
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
