IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Returns' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Returns (
        FactReturnsKey       bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey              int             NOT NULL,
        CustomerKey          int             NOT NULL,
        ProductKey           int             NOT NULL,
        SalesRepKey          int             NULL,
        WarehouseKey         int             NULL,
        CurrencyKey          int             NULL,
        DocumentTypeKey      int             NOT NULL,
        CreditNoteNumber     char(20)        NOT NULL,
        LineNumber           int             NOT NULL,
        QuantityReturned      decimal(18,5)   NOT NULL,
        GrossAmount           decimal(18,2)   NOT NULL,
        DiscountAmount        decimal(18,2)   NOT NULL,
        TaxAmount             decimal(18,2)   NOT NULL,
        NetAmount             decimal(18,2)   NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        IsVoided              bit             NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Returns_CreditNote_Line UNIQUE (CreditNoteNumber, LineNumber),
        CONSTRAINT FK_Fact_Returns_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Returns_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_Returns_Dim_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey),
        CONSTRAINT FK_Fact_Returns_Dim_SalesRep FOREIGN KEY (SalesRepKey) REFERENCES dim.Dim_SalesRep(SalesRepKey),
        CONSTRAINT FK_Fact_Returns_Dim_Warehouse FOREIGN KEY (WarehouseKey) REFERENCES dim.Dim_Warehouse(WarehouseKey),
        CONSTRAINT FK_Fact_Returns_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey),
        CONSTRAINT FK_Fact_Returns_Dim_DocumentType FOREIGN KEY (DocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey)
    );
    CREATE INDEX IX_Fact_Returns_DateKey ON fact.Fact_Returns (DateKey);
    CREATE INDEX IX_Fact_Returns_CustomerKey ON fact.Fact_Returns (CustomerKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionClienteReng')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastValidatorDateTime, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saDevolucionClienteReng', 0x0000000000000000, '1900-01-01', SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionCliente')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastValidatorDateTime, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saDevolucionCliente', 0x0000000000000000, '1900-01-01', SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_Returns
AS
BEGIN
    SET NOCOUNT ON;
    -- saDevolucionClienteReng (detail) has no `validador` column, unlike header/master tables
    -- elsewhere in this DWH — only an app-layer `fe_us_mo` (last-modified datetime), which is
    -- not a DB-generated monotonic rowversion. Accepted risk: if Profit Plus ever backdates or
    -- leaves fe_us_mo unset on some edit path, a change could theoretically be missed. This is
    -- the best available option given no validador/rowguid alternative exists on the detail
    -- table (same ruling as Fact_Sales, confirmed 2026-08-26).
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionClienteReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saDevolucionCliente');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;
    DECLARE @DcliDocTypeKey int = (SELECT DocumentTypeKey FROM dim.Dim_DocumentType WHERE RTRIM(DocumentTypeCode) = 'N/CR');

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.co_alma, r.total_art, r.prec_vta,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            r.reng_neto,
            d.co_cli, d.co_ven, d.co_mone, d.tasa, d.fec_emis, ISNULL(d.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saDevolucionClienteReng r
        INNER JOIN Ncake_a.dbo.saDevolucionCliente d ON d.doc_num = r.doc_num
        WHERE r.fe_us_mo > @DetailWatermark OR d.validador > @HeaderWatermark
    )
    MERGE fact.Fact_Returns AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey,
            c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantityReturned,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.reng_neto AS NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE cust.CustomerKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.CreditNoteNumber = src.doc_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.ProductKey = src.ProductKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.WarehouseKey = src.WarehouseKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.QuantityReturned = src.QuantityReturned,
        tgt.GrossAmount = src.GrossAmount,
        tgt.DiscountAmount = src.DiscountAmount,
        tgt.TaxAmount = src.TaxAmount,
        tgt.NetAmount = src.NetAmount,
        tgt.DocumentExchangeRate = src.DocumentExchangeRate,
        tgt.IsVoided = src.IsVoided,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
            CreditNoteNumber, LineNumber, QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.ProductKey, src.SalesRepKey, src.WarehouseKey, src.CurrencyKey, @DcliDocTypeKey,
            src.doc_num, src.reng_num, src.QuantityReturned, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saDevolucionClienteReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saDevolucionCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saDevolucionClienteReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saDevolucionCliente';
END
