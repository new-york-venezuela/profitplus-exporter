IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Collections' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Collections (
        FactCollectionsKey        bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey                   int             NOT NULL,
        CustomerKey               int             NOT NULL,
        SalesRepKey               int             NULL,
        CurrencyKey               int             NULL,
        InvoiceDocumentTypeKey    int             NULL,
        ReceiptNumber             char(20)        NOT NULL,
        InvoiceNumber             char(20)        NULL,
        LineNumber                int             NOT NULL,
        AmountCollected             decimal(18,2)   NOT NULL,
        RetentionIVAAmount          decimal(18,2)   NOT NULL,
        RetentionISLRAmount         decimal(18,2)   NOT NULL,
        EarlyPaymentDiscountAmount  decimal(18,2)   NOT NULL,
        DocumentExchangeRate       decimal(21,8)   NULL,
        IsVoided                  bit             NOT NULL,
        LoadedAtUtc                 datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Collections_Receipt_Line UNIQUE (ReceiptNumber, LineNumber),
        CONSTRAINT FK_Fact_Collections_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Collections_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_Collections_Dim_SalesRep FOREIGN KEY (SalesRepKey) REFERENCES dim.Dim_SalesRep(SalesRepKey),
        CONSTRAINT FK_Fact_Collections_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey),
        CONSTRAINT FK_Fact_Collections_Dim_DocumentType FOREIGN KEY (InvoiceDocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey)
    );
    CREATE INDEX IX_Fact_Collections_DateKey ON fact.Fact_Collections (DateKey);
    CREATE INDEX IX_Fact_Collections_CustomerKey ON fact.Fact_Collections (CustomerKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobroDocReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastValidatorDateTime, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCobroDocReng', 0x0000000000000000, '1900-01-01', SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCobro')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastValidatorDateTime, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCobro', 0x0000000000000000, '1900-01-01', SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Collections
AS
BEGIN
    SET NOCOUNT ON;
    -- saCobroDocReng (detail) has no `validador` column, unlike header/master tables elsewhere
    -- in this DWH — only an app-layer `fe_us_mo` (last-modified datetime), which is not a
    -- DB-generated monotonic rowversion. Accepted risk: if Profit Plus ever backdates or leaves
    -- fe_us_mo unset on some edit path, a change could theoretically be missed. This is the best
    -- available option given no validador/rowguid alternative exists on the detail table (same
    -- ruling as Fact_Sales/Fact_Returns, confirmed 2026-08-26).
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
    )
    MERGE fact.Fact_Collections AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(ch.fecha, 'yyyyMMdd')) AS DateKey,
            ch.reng_num, ch.cob_num, ch.nro_doc,
            cust.CustomerKey, rep.SalesRepKey, cur.CurrencyKey, dt.DocumentTypeKey,
            ch.mont_cob AS AmountCollected, ch.monto_retencion_iva AS RetentionIVAAmount,
            ch.monto_retencion AS RetentionISLRAmount, ch.dpcobro_monto AS EarlyPaymentDiscountAmount,
            ch.tasa AS DocumentExchangeRate, ch.anulado AS IsVoided
        FROM Changed ch
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(ch.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(ch.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(ch.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(ch.co_tipo_doc) COLLATE SQL_Latin1_General_CP1_CI_AS
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
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, SalesRepKey, CurrencyKey, InvoiceDocumentTypeKey,
            ReceiptNumber, InvoiceNumber, LineNumber, AmountCollected, RetentionIVAAmount,
            RetentionISLRAmount, EarlyPaymentDiscountAmount, DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.SalesRepKey, src.CurrencyKey, src.DocumentTypeKey,
            src.cob_num, src.nro_doc, src.reng_num, src.AmountCollected, src.RetentionIVAAmount,
            src.RetentionISLRAmount, src.EarlyPaymentDiscountAmount, src.DocumentExchangeRate, src.IsVoided
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
