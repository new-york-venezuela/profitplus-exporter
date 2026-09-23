-- Adds a CostCenter classification to Nomina-category expense concepts, so
-- the Finanzas tab's Nomina drilldown can show which concepts are
-- attributable to Produccion/Administracion/Ventas vs. concepts with no
-- cost-center signal in the source data at all.
--
-- Investigated live 2026-09-14 whether Nomina could be split by cost center
-- from a more precise source than concept-name keywords: saMovimientoBanco
-- has a `dis_cen` XML column literally meant for cost-center distribution,
-- and Ncake_a.dbo.scCentro defines real cost centers (PROD, PPAN, PPAST,
-- ADM, VENT, INV) -- but dis_cen is NULL on 100% of Nomina-category rows
-- checked (1,356/1,356), including rows whose concept name explicitly says
-- "Produccion". saDistribCosto (the dedicated cost-distribution table) has
-- 0 rows. This installation has never used either mechanism -- same pattern
-- as the already-documented cost-of-goods gap (0009_fact_sales.sql /
-- dwh-migrations/README.md's "Margin/cost data — deferred" note).
--
-- The only usable signal is the concept NAME itself: of the 72 Nomina-
-- category concepts, a minority explicitly say "Produccion"/"Administracion"/
-- "Ventas"/"Vendedores" (e.g. "E-04|Nomina Produc", "E-60|Nomina personal
-- administrativo", "E-217|COMISIONES VENDEDORES"). The rest -- including the
-- single largest Nomina line, "E-212|NOMINA POR PAGAR" (~38% of all Nomina
-- volume by itself) -- are generic payable/clearing/benefit concepts with no
-- cost-center indication anywhere in their name. Live-verified 2026-09-14:
-- only 6.6% of total Nomina Amount volume carries a classifiable name; 93.4%
-- does not. CostCenter is therefore NULL (shown as "Sin clasificar" in the
-- UI) for the large majority of Nomina by design -- this is an honest
-- reflection of the source data's limits, not a classification bug to fix
-- by guessing.
--
-- CostCenter is only ever meaningful for Category = 'Nomina' rows; every
-- other concept (Gasto or Ingreso) gets NULL here, same as Category itself
-- is NULL for Ingreso rows in 0017.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dim.ExpenseConceptSeed') AND name = 'CostCenter'
)
    ALTER TABLE dim.ExpenseConceptSeed ADD CostCenter varchar(20) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dim.Dim_ExpenseConcept') AND name = 'CostCenter'
)
    ALTER TABLE dim.Dim_ExpenseConcept ADD CostCenter varchar(20) NULL;
GO

-- Updates existing seed rows in place (not a TRUNCATE/re-INSERT of the
-- whole 0017 seed list) -- MERGE below is idempotent and safe to re-run.
UPDATE dim.ExpenseConceptSeed SET CostCenter = 'Produccion'
WHERE ConceptCode IN ('146', '150', 'E-04', 'E-19', 'E-28', 'E-35C', 'E-44', 'E-45', 'E-46', 'E-100');
GO

UPDATE dim.ExpenseConceptSeed SET CostCenter = 'Administracion'
WHERE ConceptCode IN ('161', 'E-35A', 'E-44A', 'E-45A', 'E-60', 'E-93', 'E-100B', 'E-106', 'E-158');
GO

UPDATE dim.ExpenseConceptSeed SET CostCenter = 'Ventas'
WHERE ConceptCode IN ('117', '160', 'E-13', 'E-35B', 'E-44PV', 'E-45V', 'E-66', 'E-84', 'E-94', 'E-100A', 'E-107', 'E-157', 'E-217');
GO

-- Widen Load_Dim_ExpenseConcept to carry CostCenter through the MERGE.
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
            seed.CostCenter AS CostCenter,
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
        tgt.CostCenter = src.CostCenter,
        tgt.IsExcludedFromEbitda = src.IsExcludedFromEbitda,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (ConceptCode, ConceptName, ConceptType, Category, CostCenter, IsExcludedFromEbitda)
        VALUES (src.ConceptCode, src.ConceptName, src.ConceptType, src.Category, src.CostCenter, src.IsExcludedFromEbitda);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCuentaIngEgr;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCuentaIngEgr';
END
GO
