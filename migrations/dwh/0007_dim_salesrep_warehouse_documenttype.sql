IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_SalesRep' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_SalesRep (
        SalesRepKey       int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SalesRepCode      char(6)       NOT NULL UNIQUE,
        SalesRepName      varchar(60)   NULL,
        RoleTypeCode      char(1)       NULL,
        IsSalesperson     bit           NOT NULL,
        IsCollector       bit           NOT NULL,
        CommissionPercent decimal(18,2) NULL,
        ZoneCode          char(6)       NULL,
        IsInactive        bit           NOT NULL,
        LoadedAtUtc        datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Warehouse' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Warehouse (
        WarehouseKey          int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        WarehouseCode         char(6)       NOT NULL UNIQUE,
        WarehouseName         varchar(60)   NULL,
        AllowsSales           bit           NOT NULL,
        AllowsPurchases       bit           NOT NULL,
        IsMaterialsWarehouse  bit           NOT NULL,
        IsProductionWarehouse bit           NOT NULL,
        HasRealStock          bit           NOT NULL,
        LoadedAtUtc             datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_DocumentType' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_DocumentType (
        DocumentTypeKey  int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DocumentTypeCode char(6)      NOT NULL UNIQUE,
        DocumentTypeName varchar(40)  NOT NULL,
        IsCredit         bit          NOT NULL,
        AffectsAR        bit          NOT NULL
    );

    INSERT INTO dim.Dim_DocumentType (DocumentTypeCode, DocumentTypeName, IsCredit, AffectsAR) VALUES
        ('FACT  ', 'Factura de Venta',   0, 1),
        ('N/CR  ', 'Nota de Credito',    1, 1),
        ('NCR   ', 'Nota de Credito',    1, 1),
        ('N/DB  ', 'Nota de Debito',     0, 1),
        ('COBR  ', 'Cobro',              0, 0),
        ('ANT   ', 'Anticipo',           0, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saVendedor')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saVendedor', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_SalesRep
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saVendedor');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE dim.Dim_SalesRep AS tgt
    USING (
        SELECT
            RTRIM(co_ven) AS SalesRepCode, ven_des, tipo,
            ISNULL(fun_ven, 0) AS IsSalesperson, ISNULL(fun_cob, 0) AS IsCollector,
            comision, co_zon, ISNULL(inactivo, 0) AS IsInactive, validador
        FROM Ncake_a.dbo.saVendedor
    ) AS src
        ON tgt.SalesRepCode = src.SalesRepCode COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED AND src.validador > @Watermark THEN UPDATE SET
        tgt.SalesRepName = src.ven_des,
        tgt.RoleTypeCode = src.tipo,
        tgt.IsSalesperson = src.IsSalesperson,
        tgt.IsCollector = src.IsCollector,
        tgt.CommissionPercent = src.comision,
        tgt.ZoneCode = src.co_zon,
        tgt.IsInactive = src.IsInactive
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (SalesRepCode, SalesRepName, RoleTypeCode, IsSalesperson, IsCollector, CommissionPercent, ZoneCode, IsInactive)
        VALUES (src.SalesRepCode, src.ven_des, src.tipo, src.IsSalesperson, src.IsCollector, src.comision, src.co_zon, src.IsInactive);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saVendedor;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saVendedor';
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Warehouse
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dim.Dim_Warehouse AS tgt
    USING (
        SELECT
            RTRIM(a.co_alma) AS WarehouseCode, a.des_alma,
            CASE WHEN ISNULL(a.noventa, 0) = 0 THEN 1 ELSE 0 END AS AllowsSales,
            CASE WHEN ISNULL(a.nocompra, 0) = 0 THEN 1 ELSE 0 END AS AllowsPurchases,
            ISNULL(a.materiales, 0) AS IsMaterialsWarehouse,
            ISNULL(a.produccion, 0) AS IsProductionWarehouse,
            CASE WHEN EXISTS (
                SELECT 1 FROM Ncake_a.dbo.saStockAlmacen s
                WHERE RTRIM(s.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_alma) COLLATE SQL_Latin1_General_CP1_CI_AS
                GROUP BY s.co_alma
                HAVING SUM(s.stock) > 0
            ) THEN 1 ELSE 0 END AS HasRealStock
        FROM Ncake_a.dbo.saAlmacen a
    ) AS src
        ON tgt.WarehouseCode = src.WarehouseCode COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.WarehouseName = src.des_alma,
        tgt.AllowsSales = src.AllowsSales,
        tgt.AllowsPurchases = src.AllowsPurchases,
        tgt.IsMaterialsWarehouse = src.IsMaterialsWarehouse,
        tgt.IsProductionWarehouse = src.IsProductionWarehouse,
        tgt.HasRealStock = src.HasRealStock
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (WarehouseCode, WarehouseName, AllowsSales, AllowsPurchases, IsMaterialsWarehouse, IsProductionWarehouse, HasRealStock)
        VALUES (src.WarehouseCode, src.des_alma, src.AllowsSales, src.AllowsPurchases, src.IsMaterialsWarehouse, src.IsProductionWarehouse, src.HasRealStock);
END
