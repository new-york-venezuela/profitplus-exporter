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
        -- 0000003 "Baguette Blanco 225gr", not 0000004 "Baguette Topping
        -- Oregano 220gr" as the spec originally guessed from the name alone —
        -- Gama has real invoice history under 0000003 (18 lines) and none
        -- under 0000004, confirmed against live Fact_Sales before correcting.
        ('Baguette 220gr',       '0000003', CAST(0 AS bit)),
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
