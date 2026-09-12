-- Mirrors fact.Fact_Sales's exact grain and ETL pattern
-- (dwh-migrations/0009_fact_sales.sql): one row per invoice line, header
-- (saFacturaCompra) joined to detail (saFacturaCompraReng) via doc_num,
-- watermark-incremental with the same "detail table has no validador, only
-- fe_us_mo" caveat that applies to saFacturaVentaReng (ruling confirmed
-- 2026-08-26, same pattern applies here per that ruling's own note).
--
-- Per this project's standing rule (established in the Finanzas plan, see
-- 0017_dim_expense_concept.sql / 0018_fact_expenses.sql, applied to
-- Dim_Supplier in 0020_dim_supplier.sql): always LTRIM(RTRIM(...)) both
-- sides of a join or comparison against a fixed-width char column sourced
-- from Ncake_a (co_prov, co_art, co_mone, doc_num), plus
-- COLLATE SQL_Latin1_General_CP1_CI_AS when comparing across the
-- Ncake_a/DWH_AlimentosNY cross-database boundary. Applied throughout this
-- migration's MERGE below, stricter than the bare RTRIM used elsewhere.
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
        INNER JOIN Ncake_a.dbo.saFacturaCompra f ON LTRIM(RTRIM(f.doc_num)) = LTRIM(RTRIM(r.doc_num))
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
        LEFT JOIN dim.Dim_Supplier sup ON LTRIM(RTRIM(sup.SupplierCode)) = LTRIM(RTRIM(c.co_prov)) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Product prod ON LTRIM(RTRIM(prod.ProductCode)) = LTRIM(RTRIM(c.co_art)) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_Currency cur ON LTRIM(RTRIM(cur.CurrencyCode)) = LTRIM(RTRIM(c.co_mone)) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        WHERE sup.SupplierKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON LTRIM(RTRIM(tgt.InvoiceNumber)) = LTRIM(RTRIM(src.doc_num)) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
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
