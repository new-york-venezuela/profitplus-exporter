IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_Currency' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_Currency (
        CurrencyKey     int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CurrencyCode    char(6)       NOT NULL UNIQUE,
        CurrencyName    varchar(60)   NULL,
        IsBaseCurrency  bit           NOT NULL,
        LoadedAtUtc     datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_ExchangeRate' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_ExchangeRate (
        DateKey      int             NOT NULL,
        CurrencyKey  int             NOT NULL,
        RateBuy      decimal(21,8)   NULL,
        RateSell     decimal(21,8)   NULL,
        LoadedAtUtc  datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Fact_ExchangeRate PRIMARY KEY (DateKey, CurrencyKey),
        CONSTRAINT FK_Fact_ExchangeRate_Dim_Date FOREIGN KEY (DateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_ExchangeRate_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saMoneda')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saMoneda', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

IF NOT EXISTS (SELECT 1 FROM dwh.EtlWatermark WHERE SourceTableName = 'saTasa')
    INSERT INTO dwh.EtlWatermark (SourceTableName, LastValidador, LastRunAtUtc, LastRowsProcessed)
    VALUES ('saTasa', 0x0000000000000000, SYSUTCDATETIME(), 0);
GO

CREATE OR ALTER PROCEDURE dwh.Load_Dim_Currency
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dim.Dim_Currency AS tgt
    USING (
        SELECT
            RTRIM(co_mone) AS CurrencyCode,
            mone_des        AS CurrencyName,
            CASE WHEN cambio = 1 THEN 1 ELSE 0 END AS IsBaseCurrency
        FROM Ncake_a.dbo.saMoneda
    ) AS src
        ON tgt.CurrencyCode = src.CurrencyCode COLLATE SQL_Latin1_General_CP1_CI_AS
    WHEN MATCHED THEN UPDATE SET
        tgt.CurrencyName = src.CurrencyName,
        tgt.IsBaseCurrency = src.IsBaseCurrency
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (CurrencyCode, CurrencyName, IsBaseCurrency)
        VALUES (src.CurrencyCode, src.CurrencyName, src.IsBaseCurrency);
END
GO

CREATE OR ALTER PROCEDURE dwh.Load_Fact_ExchangeRate
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Watermark binary(8) = (SELECT LastValidador FROM dwh.EtlWatermark WHERE SourceTableName = 'saTasa');
    DECLARE @NewWatermark binary(8);
    DECLARE @RowCount int;

    MERGE fact.Fact_ExchangeRate AS tgt
    USING (
        SELECT
            CONVERT(int, FORMAT(t.fecha, 'yyyyMMdd')) AS DateKey,
            c.CurrencyKey,
            t.tasa_c AS RateBuy,
            t.tasa_v AS RateSell
        FROM Ncake_a.dbo.saTasa t
        INNER JOIN dim.Dim_Currency c ON c.CurrencyCode = RTRIM(t.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE EXISTS (SELECT 1 FROM Ncake_a.dbo.saMoneda m WHERE RTRIM(m.co_mone) = RTRIM(t.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS)
        AND t.fecha >= '2020-01-01'
    ) AS src
        ON tgt.DateKey = src.DateKey AND tgt.CurrencyKey = src.CurrencyKey
    WHEN MATCHED THEN UPDATE SET
        tgt.RateBuy = src.RateBuy,
        tgt.RateSell = src.RateSell,
        tgt.LoadedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (DateKey, CurrencyKey, RateBuy, RateSell)
        VALUES (src.DateKey, src.CurrencyKey, src.RateBuy, src.RateSell);

    SET @RowCount = @@ROWCOUNT;
    SELECT @NewWatermark = ISNULL(MAX(validador), 0x0000000000000000) FROM Ncake_a.dbo.saTasa;

    UPDATE dwh.EtlWatermark
    SET LastValidador = @NewWatermark, LastRunAtUtc = SYSUTCDATETIME(), LastRowsProcessed = @RowCount
    WHERE SourceTableName = 'saTasa';
END
