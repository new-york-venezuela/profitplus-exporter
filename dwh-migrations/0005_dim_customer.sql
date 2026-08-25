IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Customer' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Customer (
        CustomerKey             int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CustomerCode            char(16)      NOT NULL,
        CustomerName            varchar(120)  NULL,
        TaxId                   varchar(20)   NULL,
        IsSpecialTaxpayer       bit           NOT NULL,
        CreditLimit             decimal(18,2) NULL,
        CreditLimitCurrencyCode char(6)       NULL,
        ZoneCode                char(6)       NULL,
        SegmentCode             char(6)       NULL,
        DefaultSalesRepCode     char(6)       NULL,
        IsLegalEntity           bit           NOT NULL,
        IsInactive              bit           NOT NULL,
        ValidFrom               datetime2(3)  NOT NULL,
        ValidTo                 datetime2(3)  NULL,
        IsCurrent               bit           NOT NULL,
        LoadedAtUtc              datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Dim_Customer_CustomerCode_Current ON dim.Dim_Customer (CustomerCode, IsCurrent);
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saCliente', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    -- Close out current versions whose source row changed
    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.CustomerName, '') <> ISNULL(src.cli_des, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.TaxId, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsSpecialTaxpayer, 0) <> ISNULL(src.contrib, 0)
         OR ISNULL(tgt.CreditLimit, -1) <> ISNULL(src.mont_cre, -1)
         OR ISNULL(RTRIM(tgt.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(src.co_mone), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.ZoneCode), '') <> ISNULL(RTRIM(src.co_zon), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
      );

    -- Insert new versions: brand-new customers, and customers just closed out above
    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, src.co_seg, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0), @Now, NULL, 1
    FROM Ncake_a.dbo.saCliente src
    WHERE src.validador > @Watermark
      AND NOT EXISTS (
          SELECT 1 FROM dim.Dim_Customer tgt
          WHERE RTRIM(tgt.CustomerCode) = RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND tgt.IsCurrent = 1
      );

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), @Watermark) FROM Ncake_a.dbo.saCliente;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saCliente';
END
