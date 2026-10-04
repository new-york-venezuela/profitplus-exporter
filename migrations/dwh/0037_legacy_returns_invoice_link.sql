-- 0037: fact.Fact_Returns_Legacy gets the same original-factura link that
-- 0036 gave fact.Fact_Returns, so Histórico 2025 attributes devoluciones to
-- the ORIGINAL factura's date (and converts USD at that date's rate) like the
-- rest of Analítica. The import script (scripts/dwh-legacy-2025-import.ts)
-- fills these on load; NetAmount there now also nets monto_desc_glob.
--
-- OriginalInvoiceDateKey deliberately has NO FK to dim.Dim_Date (unlike
-- Fact_Returns): a factura older than Dim_Date's first day must stay
-- representable instead of being forced back onto the devolución's date.
-- Unlinked lines fall back to DateKey with HasInvoiceLink = 0, so
-- OriginalInvoiceDateKey is never NULL after load.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns_Legacy') AND name = 'OriginalInvoiceNumber')
    ALTER TABLE fact.Fact_Returns_Legacy ADD OriginalInvoiceNumber char(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns_Legacy') AND name = 'OriginalInvoiceLineNumber')
    ALTER TABLE fact.Fact_Returns_Legacy ADD OriginalInvoiceLineNumber int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns_Legacy') AND name = 'OriginalInvoiceDateKey')
    ALTER TABLE fact.Fact_Returns_Legacy ADD OriginalInvoiceDateKey int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('fact.Fact_Returns_Legacy') AND name = 'HasInvoiceLink')
    ALTER TABLE fact.Fact_Returns_Legacy ADD HasInvoiceLink bit NOT NULL
        CONSTRAINT DF_Fact_Returns_Legacy_HasInvoiceLink DEFAULT 0;
GO

-- Rows loaded before this migration have no link data; keep the invariant.
UPDATE fact.Fact_Returns_Legacy
SET OriginalInvoiceDateKey = DateKey, HasInvoiceLink = 0
WHERE OriginalInvoiceDateKey IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Fact_Returns_Legacy_OriginalInvoiceDateKey' AND object_id = OBJECT_ID('fact.Fact_Returns_Legacy'))
    CREATE INDEX IX_Fact_Returns_Legacy_OriginalInvoiceDateKey ON fact.Fact_Returns_Legacy (OriginalInvoiceDateKey);
GO
