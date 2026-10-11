-- 0039: customer classification supplied by the business (2026-bbdd-profit.xlsx).
-- Group also lives in the ERP (saCliente.co_seg → Dim_Customer.SegmentCode); type and
-- parent customer exist only here. Populated by `bun run mapping:apply`. Re-runnable.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Dim_CustomerMapping' AND schema_id = SCHEMA_ID('dim'))
BEGIN
    CREATE TABLE dim.Dim_CustomerMapping (
        CustomerCode       char(16)     NOT NULL PRIMARY KEY,
        CustomerGroup      varchar(60)  NOT NULL,
        CustomerType       varchar(20)  NOT NULL,
        ParentCustomerName varchar(120) NOT NULL,
        EffectiveFrom      date         NOT NULL,
        LoadedAtUtc        datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

CREATE OR ALTER VIEW dim.vw_Customer_Classified AS
SELECT
    c.CustomerKey, c.CustomerCode, c.CustomerName, c.SegmentCode, c.DefaultSalesRepCode,
    c.IsCurrent, c.ValidFrom, c.ValidTo,
    m.CustomerGroup, m.CustomerType, m.ParentCustomerName, m.EffectiveFrom AS ClassificationEffectiveFrom
FROM dim.Dim_Customer c
LEFT JOIN dim.Dim_CustomerMapping m ON RTRIM(m.CustomerCode) = RTRIM(c.CustomerCode);
GO
