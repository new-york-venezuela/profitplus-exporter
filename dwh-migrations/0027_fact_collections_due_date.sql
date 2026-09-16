-- Adds due-date lineage to fact.Fact_Collections so every collection row is
-- self-describing for aging-at-time-of-payment (Part 3a of
-- docs/superpowers/specs/2026-09-15-analitica-ui-and-margin-design.md),
-- without depending on the lossy point-in-time Fact_AR_Snapshot (which only
-- ever reflects "today's" open balances, not the state at each historical
-- payment's own moment). Sourced from Ncake_a.dbo.saDocumentoVenta.fec_venc
-- -- the exact same source column dwh.Snapshot_Fact_AR already uses for
-- Fact_AR_Snapshot.DueDate (dwh-migrations/0012_fact_ar_snapshot.sql:68),
-- so this is the second, independent consumer of that column, not a new
-- due-date concept.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('fact.Fact_Collections') AND name = 'DueDateKey'
)
    ALTER TABLE fact.Fact_Collections ADD DueDateKey int NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Fact_Collections_Dim_Date_DueDate'
)
    ALTER TABLE fact.Fact_Collections
    ADD CONSTRAINT FK_Fact_Collections_Dim_Date_DueDate FOREIGN KEY (DueDateKey) REFERENCES dim.Dim_Date(DateKey);
GO

-- Rewrite of dwh.Load_Fact_Collections (0011_fact_collections.sql), adding a
-- LEFT JOIN to Ncake_a.dbo.saDocumentoVenta on InvoiceNumber (= nro_doc) to
-- resolve DueDateKey -- and re-resolving it on every incremental run's
-- WHEN MATCHED branch too, not just at initial insert, since a rerun could
-- otherwise leave an existing row's DueDateKey stale if saDocumentoVenta's
-- fec_venc for that invoice changes after the payment was first loaded.
-- Everything else in this procedure (watermark logic, the Changed CTE, every
-- other column) is unchanged from 0011 -- see that file's own comments for
-- why the two-watermark-row strategy is used here.
--
-- Rows where the invoice can't be resolved against saDocumentoVenta (fully
-- historical/pre-DWH invoices, or a receipt line whose nro_doc doesn't match
-- any current saDocumentoVenta row) get DueDateKey = NULL via the LEFT JOIN
-- -- per the spec, these are excluded from the new weekday x
-- estado-de-vencimiento chart (Task 10) but unaffected everywhere else
-- Fact_Collections is already used.
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Collections
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobroDocReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobro');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.cob_num, r.co_tipo_doc, r.nro_doc,
            ISNULL(r.mont_cob, 0) AS mont_cob,
            ISNULL(r.monto_retencion_iva, 0) AS monto_retencion_iva,
            ISNULL(r.monto_retencion, 0) AS monto_retencion,
            ISNULL(r.dpcobro_monto, 0) AS dpcobro_monto,
            c.co_cli, c.co_ven, c.co_mone, c.tasa, c.fecha, ISNULL(c.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saCobroDocReng r
        INNER JOIN Ncake_a.dbo.saCobro c ON c.cob_num = r.cob_num
        WHERE r.fe_us_mo > @DetailWatermark OR c.validador > @HeaderWatermark
    ),
    -- saDocumentoVenta.nro_doc is NOT unique on its own (live-confirmed: e.g.
    -- adjustment doc types AJNA/AJPA can share the same nro_doc as a
    -- different document) -- a plain LEFT JOIN on nro_doc alone fans a
    -- Changed row out to multiple source rows, which MERGE rejects
    -- ("attempted to UPDATE or DELETE the same row more than once").
    -- Fact_Collections has no invoice-document-type column to join on
    -- (InvoiceDocumentTypeKey is the *receipt's* document type, not the
    -- invoice's), so instead deduplicate saDocumentoVenta down to one row
    -- per nro_doc, picking the most recent fec_venc deterministically.
    DedupedDocumentoVenta AS (
        SELECT nro_doc, fec_venc,
            ROW_NUMBER() OVER (PARTITION BY RTRIM(nro_doc) ORDER BY fec_venc DESC) AS rn
        FROM Ncake_a.dbo.saDocumentoVenta
    )
    MERGE fact.Fact_Collections AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(ch.fecha, 'yyyyMMdd')) AS DateKey,
            ch.reng_num, ch.cob_num, ch.nro_doc,
            cust.CustomerKey, rep.SalesRepKey, cur.CurrencyKey, dt.DocumentTypeKey,
            ch.mont_cob AS AmountCollected, ch.monto_retencion_iva AS RetentionIVAAmount,
            ch.monto_retencion AS RetentionISLRAmount, ch.dpcobro_monto AS EarlyPaymentDiscountAmount,
            ch.tasa AS DocumentExchangeRate, ch.anulado AS IsVoided,
            dd.DateKey AS DueDateKey
        FROM Changed ch
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(ch.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(ch.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(ch.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(ch.co_tipo_doc) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN DedupedDocumentoVenta dv ON RTRIM(dv.nro_doc) = RTRIM(ch.nro_doc) COLLATE SQL_Latin1_General_CP1_CI_AS AND dv.rn = 1
        LEFT JOIN dim.Dim_Date dd ON dd.DateKey = CONVERT(int, FORMAT(dv.fec_venc, 'yyyyMMdd'))
        WHERE cust.CustomerKey IS NOT NULL
    ) AS src
        ON tgt.ReceiptNumber = src.cob_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.InvoiceDocumentTypeKey = src.DocumentTypeKey,
        tgt.InvoiceNumber = src.nro_doc,
        tgt.AmountCollected = src.AmountCollected,
        tgt.RetentionIVAAmount = src.RetentionIVAAmount,
        tgt.RetentionISLRAmount = src.RetentionISLRAmount,
        tgt.EarlyPaymentDiscountAmount = src.EarlyPaymentDiscountAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.DueDateKey = src.DueDateKey,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, SalesRepKey, CurrencyKey, InvoiceDocumentTypeKey,
            ReceiptNumber, InvoiceNumber, LineNumber, AmountCollected, RetentionIVAAmount,
            RetentionISLRAmount, EarlyPaymentDiscountAmount, DocumentExchangeRate, IsVoided,
            DueDateKey
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.SalesRepKey, src.CurrencyKey, src.DocumentTypeKey,
            src.cob_num, src.nro_doc, src.reng_num, src.AmountCollected, src.RetentionIVAAmount,
            src.RetentionISLRAmount, src.EarlyPaymentDiscountAmount, src.DocumentExchangeRate, src.IsVoided,
            src.DueDateKey
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saCobroDocReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saCobro;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCobroDocReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saCobro';
END
GO
