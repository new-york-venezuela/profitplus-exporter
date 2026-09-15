-- Excludes two 'Otros'/Gasto concepts from EBITDA/Margen Operativo that were
-- bucketed into the catch-all 'Otros' category by 0017's default with no
-- specific reasoning captured (unlike concepts 0017 flagged for a human
-- sanity check, e.g. 'BANCO|Banesco (cheques)'). Found live 2026-09-14: both
-- net strongly negative, dragging the whole Otros category negative and
-- understating Gastos Operativos (a negative "expense" line reads as
-- inflating the operating margin) — investigated because the user noticed
-- Otros showing negative values in the Finanzas tab's Gastos por categoría
-- drilldown.
--
-- '129|Cuentas por Pagar Gerencia': a management payable/loan account, not
-- an operating expense. 34 of 40 live rows are negative (credits > debits),
-- meaning money flows INTO this account — a financing movement, not a cost
-- of doing business.
--
-- '114|Diferencial cambiario': FX/exchange-rate revaluation (gain/loss on
-- holding bolivares/dollars), an accounting adjustment, not a cash outflow
-- for goods or services. Same "financial, not operating" nature as the
-- existing Intereses/Impuestos exclusions — grouped into a new
-- 'DiferencialCambiario' category rather than folded into 'Intereses' so
-- it stays separately auditable (it isn't interest expense).
UPDATE dim.ExpenseConceptSeed SET Category = 'DiferencialCambiario' WHERE ConceptCode = '114';
GO

-- Widen Load_Dim_ExpenseConcept's exclusion CASE to also cover
-- DiferencialCambiario and this one Otros concept, alongside the existing
-- Intereses/Impuestos/non-VentasOperativas-Ingreso branches (0017/0023).
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
                WHEN seed.Category IN ('Intereses', 'Impuestos', 'DiferencialCambiario') THEN 1
                WHEN seed.ConceptCode = '129' THEN 1
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
