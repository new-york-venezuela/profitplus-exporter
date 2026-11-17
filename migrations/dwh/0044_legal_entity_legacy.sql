-- 0044: casa matriz roll-up for the LEGACY customers (Analítica histórica).
-- The current DWH rolls stores up to their casa matriz through
-- dim.Dim_Customer.MatrizCode (saCliente.matriz) -> dim.Dim_LegalEntity. The legacy
-- customers never loaded that column, so this adds the same shape for them:
--   dim.Dim_Customer_Legacy.MatrizCode / LegalEntityLegacyKey and
--   dim.Dim_LegalEntity_Legacy (one row per root customer).
-- Legacy identities stay independent of the current ones: nothing here touches
-- dim.Dim_Customer / dim.Dim_LegalEntity.
--
-- Same rule as dwh.Load_Dim_LegalEntity, except that nothing is ever left without an
-- entity: a store points to its matriz when that matriz exists and is itself a root
-- (no matriz, a self-reference, or a matriz that is not a legacy customer); anything
-- else (an orphan, or a store whose matriz is itself a store) is its own root.
-- scripts/dwh-legacy-2025-import.ts loads MatrizCode and runs the procedure.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer_Legacy') AND name = 'MatrizCode')
    ALTER TABLE dim.Dim_Customer_Legacy ADD MatrizCode char(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dim.Dim_Customer_Legacy') AND name = 'LegalEntityLegacyKey')
    ALTER TABLE dim.Dim_Customer_Legacy ADD LegalEntityLegacyKey int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_LegalEntity_Legacy' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_LegalEntity_Legacy (
        LegalEntityLegacyKey int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RootCustomerCode     char(16)      NOT NULL,
        LegalEntityName      varchar(120)  NULL,
        StoreCount           int           NOT NULL,
        LoadedAtUtc          datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_Dim_LegalEntity_Legacy_RootCustomerCode ON dim.Dim_LegalEntity_Legacy (RootCustomerCode);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dim_Customer_Legacy_LegalEntityLegacyKey' AND object_id = OBJECT_ID('dim.Dim_Customer_Legacy'))
    CREATE INDEX IX_Dim_Customer_Legacy_LegalEntityLegacyKey ON dim.Dim_Customer_Legacy (LegalEntityLegacyKey);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_LegalEntity_Legacy
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #P (CustomerLegacyKey int NOT NULL PRIMARY KEY, CustomerCode char(16) NOT NULL, CustomerName varchar(120) NULL, Matriz char(16) NULL, IsTop bit NOT NULL, RootCode char(16) NOT NULL);

    INSERT INTO #P (CustomerLegacyKey, CustomerCode, CustomerName, Matriz, IsTop, RootCode)
    SELECT c.CustomerLegacyKey, c.CustomerCode, c.CustomerName, NULLIF(LTRIM(RTRIM(c.MatrizCode)), ''), 0, c.CustomerCode
    FROM dim.Dim_Customer_Legacy c;

    -- A "top" customer has no matriz, points to itself, or points to a code that is not a legacy customer.
    UPDATE p SET p.IsTop = 1
    FROM #P p
    WHERE p.Matriz IS NULL
       OR p.Matriz = LTRIM(RTRIM(p.CustomerCode))
       OR NOT EXISTS (SELECT 1 FROM #P x WHERE LTRIM(RTRIM(x.CustomerCode)) = p.Matriz);

    -- A store belongs to its matriz only when that matriz is itself a top customer.
    UPDATE p SET p.RootCode = t.CustomerCode
    FROM #P p
    JOIN #P t ON LTRIM(RTRIM(t.CustomerCode)) = p.Matriz AND t.IsTop = 1
    WHERE p.IsTop = 0;

    MERGE dim.Dim_LegalEntity_Legacy AS tgt
    USING (
        SELECT r.CustomerCode AS RootCustomerCode, r.CustomerName AS LegalEntityName,
               (SELECT COUNT(*) FROM #P m WHERE m.RootCode = r.CustomerCode) AS StoreCount
        FROM #P r
        WHERE r.RootCode = r.CustomerCode
    ) AS src
    ON tgt.RootCustomerCode = src.RootCustomerCode
    WHEN MATCHED THEN UPDATE SET tgt.LegalEntityName = src.LegalEntityName, tgt.StoreCount = src.StoreCount
    WHEN NOT MATCHED BY TARGET THEN INSERT (RootCustomerCode, LegalEntityName, StoreCount)
        VALUES (src.RootCustomerCode, src.LegalEntityName, src.StoreCount)
    WHEN NOT MATCHED BY SOURCE THEN DELETE;

    UPDATE c SET c.LegalEntityLegacyKey = le.LegalEntityLegacyKey
    FROM dim.Dim_Customer_Legacy c
    JOIN #P p ON p.CustomerLegacyKey = c.CustomerLegacyKey
    JOIN dim.Dim_LegalEntity_Legacy le ON le.RootCustomerCode = p.RootCode;

    DROP TABLE #P;
END
GO
