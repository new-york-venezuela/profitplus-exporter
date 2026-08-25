IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Product' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Product (
        ProductKey        int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductCode       char(30)      NOT NULL,
        ProductName       varchar(120)  NULL,
        ProductTypeCode   char(1)       NULL,
        CostingMethodCode char(4)       NULL,
        LineCode          char(6)       NULL,
        LineName          varchar(60)   NULL,
        SubLineCode       char(6)       NULL,
        SubLineName       varchar(60)   NULL,
        CategoryCode      char(6)       NULL,
        CategoryName      varchar(60)   NULL,
        MarginMinPercent  decimal(18,2) NULL,
        MarginMaxPercent  decimal(18,2) NULL,
        IsInactive        bit           NOT NULL,
        ValidFrom         datetime2(3)  NOT NULL,
        ValidTo           datetime2(3)  NULL,
        IsCurrent         bit           NOT NULL,
        LoadedAtUtc        datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_Product_ProductCode_Current ON dim.Dim_Product (ProductCode, IsCurrent);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saArticulo')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saArticulo', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Product
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saArticulo');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    -- Close out current versions whose source row changed
    ;WITH SourceProducts AS (
        SELECT
            a.co_art, a.art_des, a.tipo, a.tipo_cos, a.co_lin, l.lin_des,
            a.co_subl, sl.subl_des, a.co_cat, c.cat_des,
            a.margen_min, a.margen_max, a.anulado, a.validador
        FROM Ncake_a.dbo.saArticulo a
        LEFT JOIN Ncake_a.dbo.saLineaArticulo l ON RTRIM(l.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN Ncake_a.dbo.saSubLinea sl ON RTRIM(sl.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS AND RTRIM(sl.co_subl) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_subl) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN Ncake_a.dbo.saCatArticulo c ON RTRIM(c.co_cat) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_cat) COLLATE SQL_Latin1_General_CP1_CI_AS
    )
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Product tgt
    INNER JOIN SourceProducts src ON RTRIM(src.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.ProductCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.ProductName, '') <> ISNULL(src.art_des, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.CategoryCode, '') <> ISNULL(RTRIM(src.co_cat), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.LineCode, '') <> ISNULL(RTRIM(src.co_lin), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.SubLineCode, '') <> ISNULL(RTRIM(src.co_subl), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.MarginMinPercent, -1) <> ISNULL(src.margen_min, -1)
         OR ISNULL(tgt.MarginMaxPercent, -1) <> ISNULL(src.margen_max, -1)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.anulado, 0)
      );

    -- Insert new versions: brand-new products, and products just closed out above
    ;WITH SourceProducts AS (
        SELECT
            a.co_art, a.art_des, a.tipo, a.tipo_cos, a.co_lin, l.lin_des,
            a.co_subl, sl.subl_des, a.co_cat, c.cat_des,
            a.margen_min, a.margen_max, a.anulado, a.validador
        FROM Ncake_a.dbo.saArticulo a
        LEFT JOIN Ncake_a.dbo.saLineaArticulo l ON RTRIM(l.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN Ncake_a.dbo.saSubLinea sl ON RTRIM(sl.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_lin) COLLATE SQL_Latin1_General_CP1_CI_AS AND RTRIM(sl.co_subl) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_subl) COLLATE SQL_Latin1_General_CP1_CI_AS
        LEFT JOIN Ncake_a.dbo.saCatArticulo c ON RTRIM(c.co_cat) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(a.co_cat) COLLATE SQL_Latin1_General_CP1_CI_AS
    )
    INSERT INTO dim.Dim_Product (
        ProductCode, ProductName, ProductTypeCode, CostingMethodCode, LineCode, LineName,
        SubLineCode, SubLineName, CategoryCode, CategoryName, MarginMinPercent, MarginMaxPercent,
        IsInactive, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_art), src.art_des, src.tipo, src.tipo_cos, src.co_lin, src.lin_des,
        src.co_subl, src.subl_des, src.co_cat, src.cat_des, src.margen_min, src.margen_max,
        ISNULL(src.anulado, 0), @Now, NULL, 1
    FROM SourceProducts src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Product tgt
          WHERE RTRIM(tgt.ProductCode) = RTRIM(src.co_art) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.IsCurrent = 1
      );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saArticulo;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saArticulo';
END
