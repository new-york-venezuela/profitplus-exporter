-- 0036: three "ventas netas" fixes (research: .superpowers/research/ventas-netas-dwh.md).
--
-- 1. fact.Fact_Returns gets the ORIGINAL factura of each return line:
--    OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey,
--    HasInvoiceLink. DateKey stays the devolucion's own fec_emis (AR, collections
--    and the Devoluciones tab need the issue date); OriginalInvoiceDateKey lets a
--    query attribute the return to the month of the sale instead.
--    Resolution (per LINE, since one devolucion can return several facturas):
--      a) saDevolucionClienteReng.rowguid_doc -> saFacturaVentaReng.rowguid
--         (gives factura number, factura line, factura fec_emis)
--      b) fallback when (a) does not resolve: tipo_doc = 'FACT' and
--         num_doc -> saFacturaVenta.doc_num (factura number and date, no line)
--      c) neither resolves: OriginalInvoiceDateKey = DateKey, HasInvoiceLink = 0,
--         so OriginalInvoiceDateKey is never NULL after load/backfill.
--
-- 2. fact.Fact_ExchangeRate covers every calendar day: Load_Fact_ExchangeRate
--    carries the last known saTasa rate forward (per currency) to each day
--    with no saTasa row, up to today. Carried rows are flagged
--    IsCarriedForward = 1; real saTasa rows keep IsCarriedForward = 0 and their
--    values are untouched. Fixes sales on Saturdays/holidays (no saTasa row)
--    getting a NULL USD amount and silently dropping out of every USD SUM.
--
-- 3. NetAmount now nets the prorated global discount on both Fact_Sales and
--    Fact_Returns: NetAmount = reng_neto - monto_desc_glob. reng_neto is
--    total_art*prec_vta - monto_desc and does NOT include the line's share of
--    the header global discount (verified: sum(reng_neto) = total_bruto on
--    every factura), while DiscountAmount already included monto_desc_glob.
--    After this, NetAmount = GrossAmount - DiscountAmount (to the cent).
--
-- Every statement is re-runnable: columns/constraints/indexes are guarded,
-- procedures are CREATE OR ALTER, and the backfills recompute absolute values
-- from the ERP source (re-applying them yields the same result).

------------------------------------------------------------------------------
-- 1a. Fact_Returns: new columns
------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns') AND name = 'OriginalInvoiceNumber')
    ALTER TABLE fact.Fact_Returns ADD OriginalInvoiceNumber char(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns') AND name = 'OriginalInvoiceLineNumber')
    ALTER TABLE fact.Fact_Returns ADD OriginalInvoiceLineNumber int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns') AND name = 'OriginalInvoiceDateKey')
    ALTER TABLE fact.Fact_Returns ADD OriginalInvoiceDateKey int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns') AND name = 'HasInvoiceLink')
    ALTER TABLE fact.Fact_Returns ADD HasInvoiceLink bit NOT NULL
        CONSTRAINT DF_Fact_Returns_HasInvoiceLink DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Fact_Returns_Dim_Date_OriginalInvoice')
    ALTER TABLE fact.Fact_Returns
    ADD CONSTRAINT FK_Fact_Returns_Dim_Date_OriginalInvoice FOREIGN KEY (OriginalInvoiceDateKey) REFERENCES dim.Dim_Date(DateKey);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Fact_Returns_OriginalInvoiceDateKey' AND object_id = OBJECT_ID('fact.Fact_Returns'))
    CREATE INDEX IX_Fact_Returns_OriginalInvoiceDateKey ON fact.Fact_Returns (OriginalInvoiceDateKey);
GO

------------------------------------------------------------------------------
-- 2a. Fact_ExchangeRate: carried-forward flag
------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_ExchangeRate') AND name = 'IsCarriedForward')
    ALTER TABLE fact.Fact_ExchangeRate ADD IsCarriedForward bit NOT NULL
        CONSTRAINT DF_Fact_ExchangeRate_IsCarriedForward DEFAULT 0;
GO

------------------------------------------------------------------------------
-- 2b. Load_Fact_ExchangeRate: real saTasa rows (unchanged logic from 0004),
--     then fill every missing calendar day with the last known rate.
------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dwh.Load_Fact_ExchangeRate
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saTasa');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;
    DECLARE @CarriedCount int;
    DECLARE @TodayKey int = CONVERT(int, FORMAT(CAST(GETDATE() AS date), 'yyyyMMdd'));

    -- Real rates. A real saTasa row always wins: if a day was previously
    -- carried forward and saTasa later gets a row for it, this MERGE
    -- overwrites the carried values and clears IsCarriedForward.
    MERGE fact.Fact_ExchangeRate AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(t.fecha, 'yyyyMMdd')) AS DateKey,
            c.CurrencyKey,
            t.tasa_c AS RateBuy,
            t.tasa_v AS RateSell
        FROM Ncake_a.dbo.saTasa t
        INNER JOIN dim.Dim_Currency c ON c.CurrencyCode = RTRIM(t.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE EXISTS (SELECT 1 FROM Ncake_a.dbo.saMoneda m WHERE RTRIM(m.co_mone) = RTRIM(t.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS)
        AND t.fecha >= '2020-01-01'
    ) AS src
        ON tgt.DateKey = src.DateKey AND tgt.CurrencyKey = src.CurrencyKey
    WHEN MATCHED THEN UPDATE SET
        tgt.RateBuy = src.RateBuy,
        tgt.RateSell = src.RateSell,
        tgt.IsCarriedForward = 0,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, CurrencyKey, RateBuy, RateSell, IsCarriedForward)
        VALUES (src.DateKey, src.CurrencyKey, src.RateBuy, src.RateSell, 0);

    SET @RowCount = @@ROWCOUNT;

    -- Carry forward: each real rate covers every day after it up to (not
    -- including) the next real rate for the same currency, and the latest
    -- real rate covers every day up to today. Days before a currency's first
    -- real rate get nothing (there is no rate to carry). Recomputed in full
    -- every run, so a corrected/backdated saTasa row also re-prices the
    -- carried days that follow it. Only IsCarriedForward = 1 rows are ever
    -- updated here; real rows are never touched by this step.
    ;WITH RealRates AS (
        SELECT CurrencyKey, DateKey, RateBuy, RateSell,
            LEAD(DateKey) OVER (PARTITION BY CurrencyKey ORDER BY DateKey) AS NextRealDateKey
        FROM fact.Fact_ExchangeRate
        WHERE IsCarriedForward = 0
    ),
    Carried AS (
        SELECT r.CurrencyKey, d.DateKey, r.RateBuy, r.RateSell
        FROM RealRates r
        INNER JOIN dim.Dim_Date d
            ON d.DateKey > r.DateKey
           AND (r.NextRealDateKey IS NULL OR d.DateKey < r.NextRealDateKey)
           AND d.DateKey <= @TodayKey
    )
    MERGE fact.Fact_ExchangeRate AS tgt
    USING Carried AS src
        ON tgt.DateKey = src.DateKey AND tgt.CurrencyKey = src.CurrencyKey
    WHEN MATCHED AND tgt.IsCarriedForward = 1 AND (
            ISNULL(tgt.RateSell, -1) <> ISNULL(src.RateSell, -1)
         OR ISNULL(tgt.RateBuy, -1) <> ISNULL(src.RateBuy, -1)
    ) THEN UPDATE SET
        tgt.RateBuy = src.RateBuy,
        tgt.RateSell = src.RateSell,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, CurrencyKey, RateBuy, RateSell, IsCarriedForward)
        VALUES (src.DateKey, src.CurrencyKey, src.RateBuy, src.RateSell, 1);

    SET @CarriedCount = @@ROWCOUNT;

    SELECT @NewWatermark = ISNULL(MAX(validador), 0x0000000000000000) FROM Ncake_a.dbo.saTasa;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount + @CarriedCount
    WHERE SourceTableName = 'saTasa';
END
GO

------------------------------------------------------------------------------
-- 3a. Load_Fact_Sales: identical to 0009 except NetAmount now nets the
--     prorated global discount (monto_desc_glob).
------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dwh.Load_Fact_Sales
AS
BEGIN
    SET NOCOUNT ON;
    -- saFacturaVentaReng (detail) has no `validador` column, unlike header/master tables
    -- elsewhere in this DWH — only an app-layer `fe_us_mo` (last-modified datetime), which is
    -- not a DB-generated monotonic rowversion. Accepted risk: if Profit Plus ever backdates or
    -- leaves fe_us_mo unset on some edit path, a change could theoretically be missed. This is
    -- the best available option given no validador/rowguid alternative exists on the detail
    -- table (ruling confirmed 2026-08-26; same pattern applies to future detail-table loads).
    DECLARE @DetailWatermark datetime2(3) = (SELECT LastValidatorDateTime FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVentaReng');
    DECLARE @HeaderWatermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saFacturaVenta');
    DECLARE @NewDetailWatermark datetime2(3);
    DECLARE @NewHeaderWatermark binary(8);
    DECLARE @RowCount int;
    DECLARE @FactDocTypeKey int = (SELECT DocumentTypeKey FROM dim.Dim_DocumentType WHERE RTRIM(DocumentTypeCode) = 'FACT');

    ;WITH Changed AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.co_alma, r.total_art, r.prec_vta,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            -- reng_neto already nets the line discount (monto_desc) but not the
            -- line's prorated share of the header global discount.
            r.reng_neto - ISNULL(r.monto_desc_glob, 0) AS NetAmount,
            f.co_cli, f.co_ven, f.co_mone, f.tasa, f.fec_emis, ISNULL(f.anulado, 0) AS anulado
        FROM Ncake_a.dbo.saFacturaVentaReng r
        INNER JOIN Ncake_a.dbo.saFacturaVenta f ON f.doc_num = r.doc_num
        WHERE r.fe_us_mo > @DetailWatermark OR f.validador > @HeaderWatermark
    )
    MERGE fact.Fact_Sales AS tgt
    USING (
        SELECT
            dk.DateKey, c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantitySold,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided
        FROM Changed c
        LEFT JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(c.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
        LEFT JOIN dim.Dim_Product prod ON RTRIM(prod.ProductCode) = RTRIM(c.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND prod.IsCurrent = 1
        LEFT JOIN dim.Dim_SalesRep rep ON RTRIM(rep.SalesRepCode) = RTRIM(c.co_ven) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Warehouse wh ON RTRIM(wh.WarehouseCode) = RTRIM(c.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(c.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        WHERE cust.CustomerKey IS NOT NULL AND prod.ProductKey IS NOT NULL
    ) AS src
        ON tgt.InvoiceNumber = src.doc_num COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.LineNumber = src.reng_num
    WHEN MATCHED THEN UPDATE SET
        tgt.DateKey = src.DateKey,
        tgt.CustomerKey = src.CustomerKey,
        tgt.ProductKey = src.ProductKey,
        tgt.SalesRepKey = src.SalesRepKey,
        tgt.WarehouseKey = src.WarehouseKey,
        tgt.CurrencyKey = src.CurrencyKey,
        tgt.QuantitySold = src.QuantitySold,
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
            InvoiceNumber, LineNumber, QuantitySold, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            UnitCost, COGSAmount, GrossProfitAmount, CostSourceFlag, DocumentExchangeRate, IsVoided
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.ProductKey, src.SalesRepKey, src.WarehouseKey, src.CurrencyKey, @FactDocTypeKey,
            src.doc_num, src.reng_num, src.QuantitySold, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            NULL, NULL, NULL, 'NO_COST_DATA', src.DocumentExchangeRate, src.IsVoided
        );

    SET @RowCount = @@ROWCOUNT;

    SELECT @NewDetailWatermark = MAX(fe_us_mo) FROM Ncake_a.dbo.saFacturaVentaReng;
    SELECT @NewHeaderWatermark = MAX(validador) FROM Ncake_a.dbo.saFacturaVenta;

    UPDATE dwh.EtlWatermark
    SET LastValidatorDateTime = ISNULL(@NewDetailWatermark, @DetailWatermark), LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saFacturaVentaReng';

    UPDATE dwh.EtlWatermark
    SET LastValidador = ISNULL(@NewHeaderWatermark, @HeaderWatermark), LastRunAtUtc = SYSUTCDATETIME()
    WHERE SourceTableName = 'saFacturaVenta';
END
GO

------------------------------------------------------------------------------
-- 1b + 3b. Load_Fact_Returns: same as 0010 plus the original-factura link
--          columns and the global-discount-netted NetAmount.
------------------------------------------------------------------------------
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

    ;WITH Linked AS (
        SELECT
            r.reng_num, r.doc_num, r.co_art, r.co_alma, r.total_art, r.prec_vta,
            ISNULL(r.monto_desc, 0) + ISNULL(r.monto_desc_glob, 0) AS DiscountAmount,
            ISNULL(r.monto_imp, 0) + ISNULL(r.monto_imp2, 0) + ISNULL(r.monto_imp3, 0) AS TaxAmount,
            r.reng_neto - ISNULL(r.monto_desc_glob, 0) AS NetAmount,
            d.co_cli, d.co_ven, d.co_mone, d.tasa, d.fec_emis, ISNULL(d.anulado, 0) AS anulado,
            r.fe_us_mo, d.validador AS HeaderValidador,
            COALESCE(byLine.doc_num, byDoc.doc_num) AS OriginalInvoiceNumber,
            byLine.reng_num AS OriginalInvoiceLineNumber,
            COALESCE(byLine.fec_emis, byDoc.fec_emis) AS OriginalInvoiceDate,
            COALESCE(byLine.validador, byDoc.validador) AS InvoiceValidador
        FROM Ncake_a.dbo.saDevolucionClienteReng r
        INNER JOIN Ncake_a.dbo.saDevolucionCliente d ON d.doc_num = r.doc_num
        -- (a) exact factura line via rowguid_doc (ERP-to-ERP join, no collation issue)
        OUTER APPLY (
            SELECT TOP 1 fv.doc_num, fvr.reng_num, fv.fec_emis, fv.validador
            FROM Ncake_a.dbo.saFacturaVentaReng fvr
            INNER JOIN Ncake_a.dbo.saFacturaVenta fv ON fv.doc_num = fvr.doc_num
            WHERE fvr.rowguid = r.rowguid_doc
        ) byLine
        -- (b) fallback: factura header by num_doc
        OUTER APPLY (
            SELECT TOP 1 fv.doc_num, fv.fec_emis, fv.validador
            FROM Ncake_a.dbo.saFacturaVenta fv
            WHERE byLine.doc_num IS NULL
              AND RTRIM(r.tipo_doc) = 'FACT'
              AND fv.doc_num = r.num_doc
        ) byDoc
    ),
    Changed AS (
        SELECT * FROM Linked
        -- The third condition re-loads a return line when its ORIGINAL
        -- factura header changed since the last run (e.g. its fec_emis was
        -- corrected), so OriginalInvoiceDateKey does not go stale. validador
        -- is a rowversion, which SQL Server draws from one database-wide
        -- counter, so comparing a saFacturaVenta rowversion against the
        -- saDevolucionCliente watermark is meaningful: anything changed after
        -- the last run is guaranteed to be greater. (It can also re-touch a
        -- few lines whose factura changed shortly before the last run — a
        -- harmless idempotent re-MERGE.)
        WHERE fe_us_mo > @DetailWatermark
           OR HeaderValidador > @HeaderWatermark
           OR InvoiceValidador > @HeaderWatermark
    )
    MERGE fact.Fact_Returns AS tgt
    USING (
        SELECT
            dk.DateKey,
            c.reng_num, c.doc_num,
            cust.CustomerKey, prod.ProductKey, rep.SalesRepKey, wh.WarehouseKey, cur.CurrencyKey,
            c.total_art AS QuantityReturned,
            (c.total_art * c.prec_vta) AS GrossAmount,
            c.DiscountAmount, c.TaxAmount, c.NetAmount,
            c.tasa AS DocumentExchangeRate, c.anulado AS IsVoided,
            c.OriginalInvoiceNumber,
            c.OriginalInvoiceLineNumber,
            ISNULL(oid.DateKey, dk.DateKey) AS OriginalInvoiceDateKey,
            CAST(CASE WHEN oid.DateKey IS NULL THEN 0 ELSE 1 END AS bit) AS HasInvoiceLink
        FROM Changed c
        CROSS APPLY (SELECT CONVERT(int, FORMAT(c.fec_emis, 'yyyyMMdd')) AS DateKey) dk
        LEFT JOIN dim.Dim_Date oid ON oid.DateKey = CONVERT(int, FORMAT(c.OriginalInvoiceDate, 'yyyyMMdd'))
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
        tgt.OriginalInvoiceNumber = src.OriginalInvoiceNumber,
        tgt.OriginalInvoiceLineNumber = src.OriginalInvoiceLineNumber,
        tgt.OriginalInvoiceDateKey = src.OriginalInvoiceDateKey,
        tgt.HasInvoiceLink = src.HasInvoiceLink,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (
            DateKey, CustomerKey, ProductKey, SalesRepKey, WarehouseKey, CurrencyKey, DocumentTypeKey,
            CreditNoteNumber, LineNumber, QuantityReturned, GrossAmount, DiscountAmount, TaxAmount, NetAmount,
            DocumentExchangeRate, IsVoided,
            OriginalInvoiceNumber, OriginalInvoiceLineNumber, OriginalInvoiceDateKey, HasInvoiceLink
        )
        VALUES (
            src.DateKey, src.CustomerKey, src.ProductKey, src.SalesRepKey, src.WarehouseKey, src.CurrencyKey, @DcliDocTypeKey,
            src.doc_num, src.reng_num, src.QuantityReturned, src.GrossAmount, src.DiscountAmount, src.TaxAmount, src.NetAmount,
            src.DocumentExchangeRate, src.IsVoided,
            src.OriginalInvoiceNumber, src.OriginalInvoiceLineNumber, src.OriginalInvoiceDateKey, src.HasInvoiceLink
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
GO

------------------------------------------------------------------------------
-- Backfills. The incremental MERGEs above only touch rows whose source
-- changed since the watermark, so rows already loaded before 0036 would
-- otherwise keep NULL link columns and the old NetAmount forever (same gap as
-- 0028/0029). These UPDATEs recompute absolute values straight from the ERP,
-- so they are idempotent. Rows whose ERP source line no longer exists are left
-- as loaded, apart from the link fallback at the end.
------------------------------------------------------------------------------

-- Fact_Returns: original factura link + global-discount-netted NetAmount.
UPDATE tgt
SET tgt.OriginalInvoiceNumber = COALESCE(byLine.doc_num, byDoc.doc_num),
    tgt.OriginalInvoiceLineNumber = byLine.reng_num,
    tgt.OriginalInvoiceDateKey = ISNULL(oid.DateKey, tgt.DateKey),
    tgt.HasInvoiceLink = CASE WHEN oid.DateKey IS NULL THEN 0 ELSE 1 END,
    tgt.NetAmount = r.reng_neto - ISNULL(r.monto_desc_glob, 0)
FROM fact.Fact_Returns tgt
INNER JOIN Ncake_a.dbo.saDevolucionClienteReng r
    ON r.doc_num = tgt.CreditNoteNumber COLLATE SQL_Latin1_General_CP1_CI_AS
   AND r.reng_num = tgt.LineNumber
OUTER APPLY (
    SELECT TOP 1 fv.doc_num, fvr.reng_num, fv.fec_emis
    FROM Ncake_a.dbo.saFacturaVentaReng fvr
    INNER JOIN Ncake_a.dbo.saFacturaVenta fv ON fv.doc_num = fvr.doc_num
    WHERE fvr.rowguid = r.rowguid_doc
) byLine
OUTER APPLY (
    SELECT TOP 1 fv.doc_num, fv.fec_emis
    FROM Ncake_a.dbo.saFacturaVenta fv
    WHERE byLine.doc_num IS NULL
      AND RTRIM(r.tipo_doc) = 'FACT'
      AND fv.doc_num = r.num_doc
) byDoc
LEFT JOIN dim.Dim_Date oid ON oid.DateKey = CONVERT(int, FORMAT(COALESCE(byLine.fec_emis, byDoc.fec_emis), 'yyyyMMdd'));
GO

-- Fallback for any row the statement above could not reach (source line gone).
UPDATE fact.Fact_Returns
SET OriginalInvoiceDateKey = DateKey, HasInvoiceLink = 0
WHERE OriginalInvoiceDateKey IS NULL;
GO

-- Fact_Sales: global-discount-netted NetAmount (only lines that carry one).
UPDATE tgt
SET tgt.NetAmount = r.reng_neto - ISNULL(r.monto_desc_glob, 0)
FROM fact.Fact_Sales tgt
INNER JOIN Ncake_a.dbo.saFacturaVentaReng r
    ON r.doc_num = tgt.InvoiceNumber COLLATE SQL_Latin1_General_CP1_CI_AS
   AND r.reng_num = tgt.LineNumber
WHERE ISNULL(r.monto_desc_glob, 0) <> 0
  AND tgt.NetAmount <> CAST(r.reng_neto - ISNULL(r.monto_desc_glob, 0) AS decimal(18,2));
GO

-- Fact_ExchangeRate: fill the carried-forward days now (only when the
-- currency dimension is already loaded; on a fresh DWH the first incremental
-- load does it).
IF EXISTS (SELECT 1 FROM dim.Dim_Currency)
    EXEC dwh.Load_Fact_ExchangeRate;
GO
