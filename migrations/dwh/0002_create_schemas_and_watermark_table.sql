IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dwh')
BEGIN
    EXEC('CREATE SCHEMA dwh');
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dim')
BEGIN
    EXEC('CREATE SCHEMA dim');
END
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'fact')
BEGIN
    EXEC('CREATE SCHEMA fact');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EtlWatermark' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.EtlWatermark (
        SourceTableName   sysname       NOT NULL PRIMARY KEY,
        LastValidador     binary(8)     NOT NULL,
        LastRunAtUtc      datetime2(3)  NOT NULL,
        LastRowsProcessed int           NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__dwh_migrations' AND schema_id = SCHEMA_ID('dwh'))
BEGIN
    CREATE TABLE dwh.__dwh_migrations (
        name        VARCHAR(255)  NOT NULL PRIMARY KEY,
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
