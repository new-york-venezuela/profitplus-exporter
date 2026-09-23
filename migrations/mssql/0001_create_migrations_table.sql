IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__exporter_migrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.__exporter_migrations (
        name        VARCHAR(255)  NOT NULL PRIMARY KEY,
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
