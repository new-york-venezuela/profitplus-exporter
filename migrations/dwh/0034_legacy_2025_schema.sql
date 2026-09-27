IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Customer_Legacy' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Customer_Legacy (
        CustomerLegacyKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CustomerCode      char(16)      NOT NULL,
        CustomerName      varchar(120)  NULL,
        ZoneCode          char(6)       NULL,
        SegmentCode       char(6)       NULL,
        LoadedAtUtc       datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_Customer_Legacy_CustomerCode ON dim.Dim_Customer_Legacy (CustomerCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Product_Legacy' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Product_Legacy (
        ProductLegacyKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductCode      char(30)      NOT NULL,
        ProductName      varchar(120)  NULL,
        LineCode         char(6)       NULL,
        LineName         varchar(60)   NULL,
        SubLineCode      char(6)       NULL,
        SubLineName      varchar(60)   NULL,
        CategoryCode     char(6)       NULL,
        CategoryName     varchar(60)   NULL,
        LoadedAtUtc      datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_Product_Legacy_ProductCode ON dim.Dim_Product_Legacy (ProductCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_SalesRep_Legacy' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_SalesRep_Legacy (
        SalesRepLegacyKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SalesRepCode      char(6)       NOT NULL,
        SalesRepName      varchar(60)   NULL,
        ZoneCode          char(6)       NULL,
        LoadedAtUtc       datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_SalesRep_Legacy_SalesRepCode ON dim.Dim_SalesRep_Legacy (SalesRepCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Sales_Legacy' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Sales_Legacy (
        FactSalesLegacyKey   bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey              int             NOT NULL,
        CustomerLegacyKey    int             NOT NULL,
        ProductLegacyKey     int             NOT NULL,
        SalesRepLegacyKey    int             NULL,
        InvoiceNumber        char(20)        NOT NULL,
        LineNumber           int             NOT NULL,
        QuantitySold         decimal(18,5)   NOT NULL,
        NetAmount            decimal(18,2)   NOT NULL,
        DocumentExchangeRate decimal(21,8)   NULL,
        IsVoided             bit             NOT NULL,
        LoadedAtUtc          datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Sales_Legacy_Invoice_Line UNIQUE (InvoiceNumber, LineNumber),
        CONSTRAINT FK_Fact_Sales_Legacy_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Sales_Legacy_Dim_Customer_Legacy FOREIGN KEY (CustomerLegacyKey) REFERENCES dim.Dim_Customer_Legacy(CustomerLegacyKey),
        CONSTRAINT FK_Fact_Sales_Legacy_Dim_Product_Legacy FOREIGN KEY (ProductLegacyKey) REFERENCES dim.Dim_Product_Legacy(ProductLegacyKey),
        CONSTRAINT FK_Fact_Sales_Legacy_Dim_SalesRep_Legacy FOREIGN KEY (SalesRepLegacyKey) REFERENCES dim.Dim_SalesRep_Legacy(SalesRepLegacyKey)
    );
    CREATE INDEX IX_Fact_Sales_Legacy_DateKey ON fact.Fact_Sales_Legacy (DateKey);
    CREATE INDEX IX_Fact_Sales_Legacy_CustomerLegacyKey ON fact.Fact_Sales_Legacy (CustomerLegacyKey);
    CREATE INDEX IX_Fact_Sales_Legacy_ProductLegacyKey ON fact.Fact_Sales_Legacy (ProductLegacyKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_Returns_Legacy' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_Returns_Legacy (
        FactReturnsLegacyKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey              int             NOT NULL,
        CustomerLegacyKey    int             NOT NULL,
        ProductLegacyKey     int             NOT NULL,
        SalesRepLegacyKey    int             NULL,
        CreditNoteNumber     char(20)        NOT NULL,
        LineNumber           int             NOT NULL,
        QuantityReturned     decimal(18,5)   NOT NULL,
        NetAmount            decimal(18,2)   NOT NULL,
        DocumentExchangeRate decimal(21,8)   NULL,
        IsVoided             bit             NOT NULL,
        LoadedAtUtc          datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_Returns_Legacy_CreditNote_Line UNIQUE (CreditNoteNumber, LineNumber),
        CONSTRAINT FK_Fact_Returns_Legacy_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_Returns_Legacy_Dim_Customer_Legacy FOREIGN KEY (CustomerLegacyKey) REFERENCES dim.Dim_Customer_Legacy(CustomerLegacyKey),
        CONSTRAINT FK_Fact_Returns_Legacy_Dim_Product_Legacy FOREIGN KEY (ProductLegacyKey) REFERENCES dim.Dim_Product_Legacy(ProductLegacyKey),
        CONSTRAINT FK_Fact_Returns_Legacy_Dim_SalesRep_Legacy FOREIGN KEY (SalesRepLegacyKey) REFERENCES dim.Dim_SalesRep_Legacy(SalesRepLegacyKey)
    );
    CREATE INDEX IX_Fact_Returns_Legacy_DateKey ON fact.Fact_Returns_Legacy (DateKey);
    CREATE INDEX IX_Fact_Returns_Legacy_CustomerLegacyKey ON fact.Fact_Returns_Legacy (CustomerLegacyKey);
END
GO
