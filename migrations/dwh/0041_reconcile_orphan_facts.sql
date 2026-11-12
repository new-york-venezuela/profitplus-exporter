-- 0041: reconcile orphan fact rows.
--
-- Why: Load_Fact_Sales / Load_Fact_Returns / Load_Fact_Purchases are incremental MERGEs
-- with no "WHEN NOT MATCHED BY SOURCE". A document that is deleted or renumbered in the
-- ERP after it was loaded therefore stays in the DWH forever and double-counts
-- (e.g. F09760 next to F009760: same lines, same amounts, the former no longer in
-- saFacturaVenta).
--
-- dwh.Reconcile_Orphan_Facts finds fact lines whose (document, line) no longer exists in
-- the ERP detail+header, line by line (so a deleted line on a surviving invoice is caught
-- too), using the same join the loaders use. It does not touch voided documents: those
-- still exist in the ERP and are carried with IsVoided = 1.
--
--   EXEC dwh.Reconcile_Orphan_Facts;                 -- dry run, returns a report only
--   EXEC dwh.Reconcile_Orphan_Facts @Apply = 1;      -- deletes, logs to dwh.ReconcileLog
--
-- Safety: with @Apply = 1 it throws, deleting nothing, when a fact table's orphans exceed
-- @MaxOrphanPercent of its rows (default 5) or when the ERP source is empty while the
-- fact table is not (wrong database, ERP down, permissions). Deleted rows are written to
-- dwh.ReconcileLog in the same transaction.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReconcileLog' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.ReconcileLog (
        LogId       bigint          IDENTITY(1,1) PRIMARY KEY,
        RunAtUtc    datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        FactTable   varchar(30)     NOT NULL,
        DocNumber   char(20)        NOT NULL,
        LineNumber  int             NOT NULL,
        DateKey     int             NOT NULL,
        NetAmount   decimal(18,2)   NOT NULL
    );
END
GO

CREATE OR ALTER PROCEDURE dwh.Reconcile_Orphan_Facts
    @Apply            bit           = 0,
    @MaxOrphanPercent decimal(5,2)  = 5.00
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    CREATE TABLE #Orphans (
        FactTable   varchar(30)   NOT NULL,
        DocNumber   char(20)      NOT NULL,
        LineNumber  int           NOT NULL,
        DateKey     int           NOT NULL,
        NetAmount   decimal(18,2) NOT NULL
    );

    -- Same document+line match the loaders use (header INNER JOIN detail on doc_num).
    INSERT INTO #Orphans (FactTable, DocNumber, LineNumber, DateKey, NetAmount)
    SELECT 'Fact_Sales', s.InvoiceNumber, s.LineNumber, s.DateKey, s.NetAmount
    FROM fact.Fact_Sales s
    WHERE NOT EXISTS (
        SELECT 1
        FROM Ncake_a.dbo.saFacturaVentaReng r
        INNER JOIN Ncake_a.dbo.saFacturaVenta f ON f.doc_num = r.doc_num
        WHERE r.doc_num = s.InvoiceNumber COLLATE SQL_Latin1_General_CP1_CI_AS
          AND r.reng_num = s.LineNumber
    );

    INSERT INTO #Orphans (FactTable, DocNumber, LineNumber, DateKey, NetAmount)
    SELECT 'Fact_Returns', t.CreditNoteNumber, t.LineNumber, t.DateKey, t.NetAmount
    FROM fact.Fact_Returns t
    WHERE NOT EXISTS (
        SELECT 1
        FROM Ncake_a.dbo.saDevolucionClienteReng r
        INNER JOIN Ncake_a.dbo.saDevolucionCliente d ON d.doc_num = r.doc_num
        WHERE r.doc_num = t.CreditNoteNumber COLLATE SQL_Latin1_General_CP1_CI_AS
          AND r.reng_num = t.LineNumber
    );

    -- Purchases are matched trimmed on both sides, as Load_Fact_Purchases does.
    INSERT INTO #Orphans (FactTable, DocNumber, LineNumber, DateKey, NetAmount)
    SELECT 'Fact_Purchases', p.InvoiceNumber, p.LineNumber, p.DateKey, p.NetAmount
    FROM fact.Fact_Purchases p
    WHERE NOT EXISTS (
        SELECT 1
        FROM Ncake_a.dbo.saFacturaCompraReng r
        INNER JOIN Ncake_a.dbo.saFacturaCompra f ON LTRIM(RTRIM(f.doc_num)) = LTRIM(RTRIM(r.doc_num))
        WHERE LTRIM(RTRIM(r.doc_num)) = LTRIM(RTRIM(p.InvoiceNumber)) COLLATE SQL_Latin1_General_CP1_CI_AS
          AND r.reng_num = p.LineNumber
    );

    DECLARE @SalesSrc int = (SELECT COUNT(*) FROM Ncake_a.dbo.saFacturaVentaReng);
    DECLARE @RetSrc   int = (SELECT COUNT(*) FROM Ncake_a.dbo.saDevolucionClienteReng);
    DECLARE @PurSrc   int = (SELECT COUNT(*) FROM Ncake_a.dbo.saFacturaCompraReng);

    CREATE TABLE #Report (
        FactTable       varchar(30)   NOT NULL,
        FactRows        int           NOT NULL,
        OrphanLines     int           NOT NULL,
        OrphanDocuments int           NOT NULL,
        OrphanNetAmount decimal(18,2) NOT NULL,
        OrphanPercent   decimal(9,4)  NOT NULL,
        SourceRows      int           NOT NULL,
        Blocked         bit           NOT NULL
    );

    INSERT INTO #Report
    SELECT x.FactTable, x.FactRows,
           ISNULL(o.Lines, 0), ISNULL(o.Docs, 0), ISNULL(o.Net, 0),
           CASE WHEN x.FactRows = 0 THEN 0 ELSE CONVERT(decimal(9,4), 100.0 * ISNULL(o.Lines, 0) / x.FactRows) END,
           x.SourceRows,
           CASE WHEN (x.SourceRows = 0 AND x.FactRows > 0)
                  OR (x.FactRows > 0 AND 100.0 * ISNULL(o.Lines, 0) / x.FactRows > @MaxOrphanPercent)
                THEN 1 ELSE 0 END
    FROM (
        SELECT 'Fact_Sales' AS FactTable, (SELECT COUNT(*) FROM fact.Fact_Sales) AS FactRows, @SalesSrc AS SourceRows
        UNION ALL SELECT 'Fact_Returns',   (SELECT COUNT(*) FROM fact.Fact_Returns),   @RetSrc
        UNION ALL SELECT 'Fact_Purchases', (SELECT COUNT(*) FROM fact.Fact_Purchases), @PurSrc
    ) x
    LEFT JOIN (
        SELECT FactTable, COUNT(*) AS Lines, COUNT(DISTINCT DocNumber) AS Docs, SUM(NetAmount) AS Net
        FROM #Orphans GROUP BY FactTable
    ) o ON o.FactTable = x.FactTable;

    SELECT FactTable, FactRows, OrphanLines, OrphanDocuments, OrphanNetAmount, OrphanPercent, SourceRows, Blocked
    FROM #Report ORDER BY FactTable;

    IF @Apply = 1
    BEGIN
        IF EXISTS (SELECT 1 FROM #Report WHERE Blocked = 1)
        BEGIN
            THROW 50041, 'Reconcile_Orphan_Facts: orphan lines exceed @MaxOrphanPercent (or the ERP source is empty) for at least one fact table. Nothing was deleted. Run a dry run (@Apply = 0), inspect the orphans, then re-run with a higher @MaxOrphanPercent if they are genuine.', 1;
        END

        BEGIN TRANSACTION;

        INSERT INTO dwh.ReconcileLog (FactTable, DocNumber, LineNumber, DateKey, NetAmount)
        SELECT FactTable, DocNumber, LineNumber, DateKey, NetAmount FROM #Orphans;

        DELETE s FROM fact.Fact_Sales s
        INNER JOIN #Orphans o ON o.FactTable = 'Fact_Sales' AND o.DocNumber = s.InvoiceNumber AND o.LineNumber = s.LineNumber;

        DELETE t FROM fact.Fact_Returns t
        INNER JOIN #Orphans o ON o.FactTable = 'Fact_Returns' AND o.DocNumber = t.CreditNoteNumber AND o.LineNumber = t.LineNumber;

        DELETE p FROM fact.Fact_Purchases p
        INNER JOIN #Orphans o ON o.FactTable = 'Fact_Purchases' AND o.DocNumber = p.InvoiceNumber AND o.LineNumber = p.LineNumber;

        COMMIT TRANSACTION;
    END
END
