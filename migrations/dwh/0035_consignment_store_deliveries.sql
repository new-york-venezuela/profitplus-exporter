-- New store for Gama, not yet backed by a real saCliente row in the ERP —
-- see docs/superpowers/specs/2026-09-27-consignment-store-deliveries-design.md
-- Section 1. If Load_Dim_Customer later finds a real saCliente row for this
-- store, its own SCD2 logic takes over from here with no special handling.
IF NOT EXISTS (SELECT 1 FROM dim.Dim_Customer WHERE RTRIM(CustomerCode) = 'J-301420608-24')
BEGIN
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent, LegalEntityKey
    )
    VALUES (
        'J-301420608-24 ', 'EXCELSIOR GAMA SUPERMERCADOS, C.A. (La Joya)', NULL, NULL, 0, NULL, NULL,
        'CCS   ', NULL, NULL, 0, 0, 'J-301420608     ', SYSUTCDATETIME(), NULL, 1, 26
    );
END
GO

-- Ensure seed products exist for testing (these codes are from the Excel mapping)
-- In production, Load_Dim_Product syncs with the ERP; in test/dev they must be pre-seeded
IF NOT EXISTS (SELECT 1 FROM dim.Dim_Product WHERE RTRIM(ProductCode) = '0000007' AND IsCurrent = 1)
BEGIN
    INSERT INTO dim.Dim_Product (
        ProductCode, ProductName, ProductTypeCode, CostingMethodCode, LineCode, LineName,
        SubLineCode, SubLineName, CategoryCode, CategoryName, MarginMinPercent, MarginMaxPercent,
        IsInactive, ValidFrom, ValidTo, IsCurrent
    )
    VALUES
        ('0000007', '4 Granos 500gr',      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000008', '7 Cereales 600gr',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000009', 'Miel y pasas 600gr',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000022', 'Pan Blanco 600gr',    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000016', 'Magdalena',           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000011', 'Molido 300gr',        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000004', 'Baguette 220gr',      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000017', 'cheese Cake fresa',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000018', 'cheese Cake Choco',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000002', 'Pizza Margarita 270', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000014', 'Pizza Magarita Cj',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000015', 'Pizza New York Cj',   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1),
        ('0000020', 'Pizza Americana Cj',  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, SYSUTCDATETIME(), NULL, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConsignmentProductMap' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.ConsignmentProductMap (
        ConsignmentProductMapKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SourceClientTag          varchar(40)  NOT NULL,
        ExcelProductName         varchar(60)  NOT NULL,
        ProductKey               int          NOT NULL,
        IsBoxUnit                bit          NOT NULL DEFAULT 0,
        CONSTRAINT FK_ConsignmentProductMap_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
    );
    CREATE UNIQUE INDEX IX_ConsignmentProductMap_Client_Name ON dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.ConsignmentProductMap WHERE SourceClientTag = 'gama')
BEGIN
    INSERT INTO dwh.ConsignmentProductMap (SourceClientTag, ExcelProductName, ProductKey, IsBoxUnit)
    SELECT 'gama', v.ExcelProductName, p.ProductKey, v.IsBoxUnit
    FROM (VALUES
        ('4 Granos 500gr',       '0000007', CAST(0 AS bit)),
        ('7 Cereales 600gr',     '0000008', CAST(0 AS bit)),
        ('Miel y pasas 600gr',   '0000009', CAST(0 AS bit)),
        ('Pan Blanco 600gr',     '0000022', CAST(0 AS bit)),
        ('Magdalena',            '0000016', CAST(0 AS bit)),
        ('Molido 300gr',         '0000011', CAST(0 AS bit)),
        ('Baguette 220gr',       '0000004', CAST(0 AS bit)),
        ('cheese Cake fresa',    '0000017', CAST(0 AS bit)),
        ('cheese Cake Choco',    '0000018', CAST(0 AS bit)),
        ('Pizza Margarita 270',  '0000002', CAST(0 AS bit)),
        ('Pizza Magarita Cj',    '0000014', CAST(1 AS bit)),
        ('Pizza New York Cj',    '0000015', CAST(1 AS bit)),
        ('Pizza Americana Cj',   '0000020', CAST(1 AS bit))
    ) AS v(ExcelProductName, ProductCode, IsBoxUnit)
    INNER JOIN dim.Dim_Product p ON RTRIM(p.ProductCode) = v.ProductCode AND p.IsCurrent = 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_ConsignmentDeliveries' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_ConsignmentDeliveries (
        FactConsignmentDeliveryKey bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DateKey               int             NOT NULL,
        CustomerKey           int             NOT NULL,
        ProductKey            int             NOT NULL,
        NotaEntregaNum        varchar(30)     NULL,
        QuantityDelivered     decimal(18,5)   NOT NULL,
        UnitPriceUsd          decimal(18,5)   NULL,
        LineAmountUsd         decimal(18,2)   NULL,
        SourceClientTag       varchar(40)     NOT NULL,
        SourceFileName        varchar(200)    NOT NULL,
        SourceRowKey          varchar(64)     NOT NULL,
        SourceRowContentHash  varchar(64)     NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_ConsignmentDeliveries_Product FOREIGN KEY (ProductKey) REFERENCES dim.Dim_Product(ProductKey)
    );
    CREATE UNIQUE INDEX IX_Fact_ConsignmentDeliveries_RowKey ON fact.Fact_ConsignmentDeliveries (SourceRowKey);
    CREATE INDEX IX_Fact_ConsignmentDeliveries_DateKey ON fact.Fact_ConsignmentDeliveries (DateKey);
    CREATE INDEX IX_Fact_ConsignmentDeliveries_CustomerKey ON fact.Fact_ConsignmentDeliveries (CustomerKey);
END
GO
