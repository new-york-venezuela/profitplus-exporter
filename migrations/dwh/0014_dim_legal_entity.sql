-- New columns on Dim_Customer: raw matriz link from source, and the
-- resolved entity FK populated by Load_Dim_LegalEntity below.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer') AND name = 'MatrizCode')
    ALTER TABLE dim.Dim_Customer ADD MatrizCode char(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer') AND name = 'LegalEntityKey')
    ALTER TABLE dim.Dim_Customer ADD LegalEntityKey int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_LegalEntity' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_LegalEntity (
        LegalEntityKey   int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RootCustomerCode char(16)      NOT NULL,
        LegalEntityName  varchar(120)  NULL,
        StoreCount       int           NOT NULL,
        LoadedAtUtc      datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_LegalEntity_RootCustomerCode ON dim.Dim_LegalEntity (RootCustomerCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dim_Customer_LegalEntityKey' AND object_id = OBJECT_ID('dim.Dim_Customer'))
    CREATE INDEX IX_Dim_Customer_LegalEntityKey ON dim.Dim_Customer (LegalEntityKey);
GO

-- Load_Dim_Customer gains MatrizCode in its change-detection, INSERT, and
-- SELECT lists, following its existing SCD Type 2 pattern exactly (close
-- out + insert new version, never UPDATE an attribute in place).
CREATE OR ALTER PROCEDURE dwh.Load_Dim_Customer
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saCliente');
    DECLARE @NewWatermark binary(8);
    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @RowCount int;

    UPDATE tgt
    SET tgt.ValidTo = @Now, tgt.IsCurrent = 0
    FROM dim.Dim_Customer tgt
    INNER JOIN Ncake_a.dbo.saCliente src ON RTRIM(src.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS = RTRIM(tgt.CustomerCode)
    WHERE tgt.IsCurrent = 1
      AND src.validador > @Watermark
      AND (
            ISNULL(tgt.CustomerName, '') <> ISNULL(src.cli_des, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.TaxId, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.LegalEntityRIF, '') <> ISNULL(src.rif, '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsSpecialTaxpayer, 0) <> ISNULL(src.contrib, 0)
         OR ISNULL(tgt.CreditLimit, -1) <> ISNULL(src.mont_cre, -1)
         OR ISNULL(RTRIM(tgt.CreditLimitCurrencyCode), '') <> ISNULL(RTRIM(src.co_mone), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.ZoneCode), '') <> ISNULL(RTRIM(src.co_zon), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.SegmentCode), '') <> ISNULL(RTRIM(src.co_seg), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(RTRIM(tgt.DefaultSalesRepCode), '') <> ISNULL(RTRIM(src.co_ven), '') COLLATE SQL_Latin1_General_CP1_CI_AS
         OR ISNULL(tgt.IsLegalEntity, 0) <> ISNULL(src.juridico, 0)
         OR ISNULL(tgt.IsInactive, 0) <> ISNULL(src.inactivo, 0)
         OR ISNULL(RTRIM(tgt.MatrizCode), '') <> ISNULL(RTRIM(src.matriz), '') COLLATE SQL_Latin1_General_CP1_CI_AS
      );

    INSERT INTO dim.Dim_Customer (
        CustomerCode, CustomerName, TaxId, LegalEntityRIF, IsSpecialTaxpayer, CreditLimit, CreditLimitCurrencyCode,
        ZoneCode, SegmentCode, DefaultSalesRepCode, IsLegalEntity, IsInactive, MatrizCode, ValidFrom, ValidTo, IsCurrent
    )
    SELECT
        RTRIM(src.co_cli), src.cli_des, src.rif, src.rif, ISNULL(src.contrib, 0), src.mont_cre, src.co_mone,
        src.co_zon, src.co_seg, src.co_ven, ISNULL(src.juridico, 0), ISNULL(src.inactivo, 0),
        NULLIF(RTRIM(src.matriz), ''), @Now, NULL, 1
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
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_LegalEntity
AS
BEGIN
    SET NOCOUNT ON;

    -- Step 1: upsert one Dim_LegalEntity row per root (parent-with-children, or standalone).
    -- A row is a "root" if it has no MatrizCode, or its MatrizCode doesn't
    -- resolve to any current customer row (orphaned/bad data - treated as
    -- its own root rather than dropped).
    MERGE dim.Dim_LegalEntity AS tgt
    USING (
        SELECT
            root.CustomerCode AS RootCustomerCode,
            root.CustomerName AS LegalEntityName,
            1 + ISNULL(child_counts.ChildCount, 0) AS StoreCount
        FROM dim.Dim_Customer root
        LEFT JOIN (
            SELECT LTRIM(RTRIM(c.MatrizCode)) AS ParentCode, COUNT(*) AS ChildCount
            FROM dim.Dim_Customer c
            WHERE c.IsCurrent = 1 AND c.MatrizCode IS NOT NULL AND LTRIM(RTRIM(c.MatrizCode)) <> ''
            GROUP BY LTRIM(RTRIM(c.MatrizCode))
        ) child_counts ON child_counts.ParentCode = root.CustomerCode
        WHERE root.IsCurrent = 1
          AND (
                root.MatrizCode IS NULL OR LTRIM(RTRIM(root.MatrizCode)) = ''
             OR NOT EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(root.MatrizCode))
                )
          )
    ) AS src
    ON tgt.RootCustomerCode = src.RootCustomerCode
    WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
    WHEN NOT MATCHED THEN INSERT (RootCustomerCode, LegalEntityName, StoreCount, LoadedAtUtc)
        VALUES (src.RootCustomerCode, src.LegalEntityName, src.StoreCount, SYSUTCDATETIME());

    -- Step 2: backfill Dim_Customer.LegalEntityKey for every current row (root or child).
    -- Mirrors step 1's root-resolution exactly.
    UPDATE c
    SET c.LegalEntityKey = le.LegalEntityKey
    FROM dim.Dim_Customer c
    JOIN dim.Dim_LegalEntity le
      ON le.RootCustomerCode = CASE
           WHEN LTRIM(RTRIM(ISNULL(c.MatrizCode, ''))) <> ''
                AND EXISTS (
                    SELECT 1 FROM dim.Dim_Customer p
                    WHERE p.IsCurrent = 1 AND p.CustomerCode = LTRIM(RTRIM(c.MatrizCode))
                )
           THEN LTRIM(RTRIM(c.MatrizCode))
           ELSE c.CustomerCode
         END
    WHERE c.IsCurrent = 1 AND (c.LegalEntityKey IS NULL OR c.LegalEntityKey <> le.LegalEntityKey);
END
