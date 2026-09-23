IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fact_AR_Snapshot' AND schema_id = SCHEMA_ID('fact'))
BEGIN
    CREATE TABLE fact.Fact_AR_Snapshot (
        FactARSnapshotKey    bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SnapshotDateKey      int             NOT NULL,
        CustomerKey          int             NOT NULL,
        DocumentTypeKey      int             NULL,
        InvoiceNumber        char(20)        NOT NULL,
        CurrencyKey          int             NULL,
        OutstandingBalance    decimal(18,2)   NOT NULL,
        DocumentExchangeRate  decimal(21,8)   NULL,
        DueDate               date            NULL,
        DaysPastDue           int             NULL,
        AgingBucket           varchar(10)     NOT NULL,
        IsCreditNote          bit             NOT NULL,
        LoadedAtUtc            datetime2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Fact_AR_Snapshot_Date_Invoice UNIQUE (SnapshotDateKey, InvoiceNumber),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Date FOREIGN KEY (SnapshotDateKey) REFERENCES dim.Dim_Date(DateKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Customer FOREIGN KEY (CustomerKey) REFERENCES dim.Dim_Customer(CustomerKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_DocumentType FOREIGN KEY (DocumentTypeKey) REFERENCES dim.Dim_DocumentType(DocumentTypeKey),
        CONSTRAINT FK_Fact_AR_Snapshot_Dim_Currency FOREIGN KEY (CurrencyKey) REFERENCES dim.Dim_Currency(CurrencyKey)
    );
    CREATE INDEX IX_Fact_AR_Snapshot_SnapshotDateKey ON fact.Fact_AR_Snapshot (SnapshotDateKey);
    CREATE INDEX IX_Fact_AR_Snapshot_CustomerKey ON fact.Fact_AR_Snapshot (CustomerKey);
END
GO

CREATE OR ALTER PROCEDURE dwh.Snapshot_Fact_AR
    @SnapshotDate date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @SnapshotDate IS NULL SET @SnapshotDate = CAST(SYSUTCDATETIME() AS date);
    DECLARE @SnapshotDateKey int = CONVERT(int, FORMAT(@SnapshotDate, 'yyyyMMdd'));

    IF NOT EXISTS (SELECT 1 FROM dim.Dim_Date WHERE DateKey = @SnapshotDateKey)
    BEGIN
        -- RAISERROR's %s substitution requires a character-typed argument (and only a
        -- variable or literal, not an inline function call); a `date`-typed argument fails
        -- at runtime with "Cannot specify date data type (parameter 4) as a substitution
        -- parameter." (error 2748). Convert to varchar into a local variable first —
        -- transcription fix to the brief's SQL, not a design change.
        DECLARE @SnapshotDateStr varchar(10) = CONVERT(varchar(10), @SnapshotDate, 120);
        RAISERROR('Snapshot date %s (key %d) is outside the Dim_Date calendar range. Extend Dim_Date before snapshotting.', 16, 1, @SnapshotDateStr, @SnapshotDateKey);
        RETURN;
    END

    DELETE FROM fact.Fact_AR_Snapshot WHERE SnapshotDateKey = @SnapshotDateKey;

    -- This is a periodic snapshot fact: no watermark/incremental logic by design.
    -- Every snapshot run captures a complete point-in-time picture of open AR.
    -- saDocumentoVenta is a flat header-level table in Ncake_a (a different database/collation
    -- than this DWH), so the three dim.* joins below need COLLATE on the ERP side to avoid a
    -- collation conflict — same standing pattern as every other cross-database join in this DWH
    -- (see 0009_fact_sales.sql, 0010_fact_returns.sql, 0011_fact_collections.sql).
    INSERT INTO fact.Fact_AR_Snapshot (
        SnapshotDateKey, CustomerKey, DocumentTypeKey, InvoiceNumber, CurrencyKey,
        OutstandingBalance, DocumentExchangeRate, DueDate, DaysPastDue, AgingBucket, IsCreditNote
    )
    SELECT
        @SnapshotDateKey,
        cust.CustomerKey,
        dt.DocumentTypeKey,
        RTRIM(d.nro_doc),
        cur.CurrencyKey,
        d.saldo,
        d.tasa,
        CAST(d.fec_venc AS date),
        DATEDIFF(day, d.fec_venc, @SnapshotDate),
        CASE
            WHEN RTRIM(d.co_tipo_doc) IN ('N/CR', 'NCR') THEN 'N/A'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) <= 0 THEN 'Current'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, d.fec_venc, @SnapshotDate) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '>90'
        END,
        CASE WHEN RTRIM(d.co_tipo_doc) IN ('N/CR', 'NCR') THEN 1 ELSE 0 END
    FROM Ncake_a.dbo.saDocumentoVenta d
    INNER JOIN dim.Dim_Customer cust ON RTRIM(cust.CustomerCode) = RTRIM(d.co_cli) COLLATE SQL_Latin1_General_CP1_CI_AS AND cust.IsCurrent = 1
    LEFT JOIN dim.Dim_DocumentType dt ON RTRIM(dt.DocumentTypeCode) = RTRIM(d.co_tipo_doc) COLLATE SQL_Latin1_General_CP1_CI_AS
    LEFT JOIN dim.Dim_Currency cur ON RTRIM(cur.CurrencyCode) = RTRIM(d.co_mone) COLLATE SQL_Latin1_General_CP1_CI_AS
    WHERE ISNULL(d.anulado, 0) = 0 AND d.saldo <> 0;
END
