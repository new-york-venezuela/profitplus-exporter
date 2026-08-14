-- DW_Profit — Core schema DDL
-- Schemas: stg (staging), ops (operational inventory), dw (dimensional model),
-- snap (nightly snapshots). Idempotent — safe to re-run.
--
-- Fase 1 (scripts/etl_dw.py) already created dbo.Fact_Ventas,
-- dbo.Snapshot_FlujoCaja_CuentasPorCobrar and dbo.Snapshot_Inventario directly
-- in dbo. Those are left untouched (by explicit decision) — this script adds
-- the stg/ops/dw/snap schemas as new, additional structure alongside them.
--
-- Source of truth for column names: erp-knowledge-base/docs/tables/*.md,
-- cross-checked against the real local dev DB (Ncake_a) columns.

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'DW_Profit')
BEGIN
    CREATE DATABASE DW_Profit;
END
GO

USE DW_Profit;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'stg')
    EXEC('CREATE SCHEMA stg');
GO
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'ops')
    EXEC('CREATE SCHEMA ops');
GO
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dw')
    EXEC('CREATE SCHEMA dw');
GO
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'snap')
    EXEC('CREATE SCHEMA snap');
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- stg — Staging: direct pass-through copies from Profit Plus, truncated and
-- reloaded on each ETL run. Column shapes mirror the source tables exactly;
-- no business logic here.
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saFacturaVenta')
CREATE TABLE stg.saFacturaVenta (
    doc_num     CHAR(20)      NOT NULL,
    co_cli      CHAR(20)      NULL,
    co_ven      CHAR(20)      NULL,
    co_mone     CHAR(6)       NULL,
    fec_emis    SMALLDATETIME NULL,
    fec_venc    SMALLDATETIME NULL,
    tasa        DECIMAL(21,8) NULL,
    total_bruto DECIMAL(18,4) NULL,
    monto_imp   DECIMAL(18,4) NULL,
    total_neto  DECIMAL(18,4) NULL,
    saldo       DECIMAL(18,4) NULL,
    anulado     BIT           NULL,
    n_control   VARCHAR(20)   NULL,
    contrib     BIT           NULL,
    PRIMARY KEY (doc_num)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saFacturaVentaReng')
CREATE TABLE stg.saFacturaVentaReng (
    doc_num    CHAR(20)      NOT NULL,
    reng_num   INT           NOT NULL,
    co_art     CHAR(30)      NULL,
    co_alma    CHAR(6)       NULL,
    total_art  DECIMAL(18,5) NULL,
    reng_neto  DECIMAL(18,4) NULL,
    PRIMARY KEY (doc_num, reng_num)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saDocumentoVenta')
CREATE TABLE stg.saDocumentoVenta (
    co_tipo_doc CHAR(6)       NOT NULL,
    nro_doc     CHAR(20)      NOT NULL,
    co_cli      CHAR(20)      NULL,
    co_ven      CHAR(20)      NULL,
    tasa        DECIMAL(21,8) NULL,
    fec_emis    SMALLDATETIME NULL,
    fec_venc    SMALLDATETIME NULL,
    total_neto  DECIMAL(18,4) NULL,
    saldo       DECIMAL(18,4) NULL,
    anulado     BIT           NULL,
    PRIMARY KEY (co_tipo_doc, nro_doc)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saStockAlmacen')
CREATE TABLE stg.saStockAlmacen (
    co_alma CHAR(6)       NOT NULL,
    co_art  CHAR(30)      NOT NULL,
    tipo    CHAR(6)       NOT NULL,
    stock   DECIMAL(18,5) NULL,
    PRIMARY KEY (co_alma, co_art, tipo)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saArticulo')
CREATE TABLE stg.saArticulo (
    co_art     CHAR(30)      NOT NULL,
    art_des    VARCHAR(200)  NULL,
    co_lin     CHAR(6)       NULL,
    anulado    BIT           NULL,
    stock_min  DECIMAL(18,4) NULL,
    stock_max  DECIMAL(18,4) NULL,
    tipo_cos   CHAR(1)       NULL,
    PRIMARY KEY (co_art)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saCliente')
CREATE TABLE stg.saCliente (
    co_cli  CHAR(20)     NOT NULL,
    cli_des VARCHAR(200) NULL,
    co_ven  CHAR(20)     NULL,
    rif     VARCHAR(20)  NULL,
    contrib BIT          NULL,
    PRIMARY KEY (co_cli)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saVendedor')
CREATE TABLE stg.saVendedor (
    co_ven  CHAR(20)     NOT NULL,
    ven_des VARCHAR(200) NULL,
    PRIMARY KEY (co_ven)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'stg' AND t.name = 'saTasa')
CREATE TABLE stg.saTasa (
    co_mone CHAR(6)        NOT NULL,
    fecha   SMALLDATETIME  NOT NULL,
    tasa_c  DECIMAL(21,8)  NULL,
    tasa_v  DECIMAL(21,8)  NULL,
    PRIMARY KEY (co_mone, fecha)
);
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- ops — Operational inventory module: replaces Profit's own inventory
-- screens for day-to-day stock queries and adjustments. Synced from Profit
-- Plus (near-real-time refresh) but adjustments recorded here are the ops
-- team's own record — NOT written back to Profit Plus automatically.
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'ops' AND t.name = 'Stock')
CREATE TABLE ops.Stock (
    co_art        CHAR(30)      NOT NULL,
    co_alma       CHAR(6)       NOT NULL,
    Stock_Actual  DECIMAL(18,5) NOT NULL DEFAULT 0,
    Stock_Minimo  DECIMAL(18,4) NULL,
    Stock_Maximo  DECIMAL(18,4) NULL,
    Sync_Timestamp DATETIME2    NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (co_art, co_alma)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'ops' AND t.name = 'Ajustes')
CREATE TABLE ops.Ajustes (
    Ajuste_Id     INT IDENTITY(1,1) NOT NULL,
    co_art        CHAR(30)      NOT NULL,
    co_alma       CHAR(6)       NOT NULL,
    Tipo_Ajuste   VARCHAR(20)   NOT NULL,  -- 'ENTRADA' | 'SALIDA' | 'MERMA'
    Cantidad      DECIMAL(18,5) NOT NULL,
    Motivo        VARCHAR(200)  NULL,
    Usuario       VARCHAR(50)   NOT NULL,
    Fecha         DATETIME2     NOT NULL DEFAULT GETDATE(),
    -- Set once this adjustment has been reconciled against a Profit Plus
    -- saAjuste document (manual accounting entry, out of scope for this ETL).
    Profit_Ajue_Num CHAR(20)    NULL,
    PRIMARY KEY (Ajuste_Id)
);
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'ops' AND v.name = 'AlertasReorden')
    DROP VIEW ops.AlertasReorden;
GO

CREATE VIEW ops.AlertasReorden AS
SELECT
    s.co_art,
    s.co_alma,
    s.Stock_Actual,
    s.Stock_Minimo,
    (s.Stock_Minimo - s.Stock_Actual) AS Deficit
FROM ops.Stock s
WHERE s.Stock_Minimo IS NOT NULL
  AND s.Stock_Actual < s.Stock_Minimo;
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- dw — Dimensional model (star schema). Bi-currency: *_BS stored, *_USD
-- computed from the document's own tasa (never the current rate).
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Dim_Cliente')
CREATE TABLE dw.Dim_Cliente (
    Cliente_Key   VARCHAR(20)  NOT NULL,
    Cliente_Des   VARCHAR(200) NULL,
    Vendedor_Key  VARCHAR(20)  NULL,
    RIF           VARCHAR(20)  NULL,
    Contribuyente_Especial BIT NULL,
    PRIMARY KEY (Cliente_Key)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Dim_Articulo')
CREATE TABLE dw.Dim_Articulo (
    Articulo_Key  VARCHAR(30)  NOT NULL,
    Articulo_Des  VARCHAR(200) NULL,
    Linea_Key     VARCHAR(6)   NULL,
    Activo        BIT          NULL,
    PRIMARY KEY (Articulo_Key)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Dim_Vendedor')
CREATE TABLE dw.Dim_Vendedor (
    Vendedor_Key  VARCHAR(20)  NOT NULL,
    Vendedor_Des  VARCHAR(200) NULL,
    PRIMARY KEY (Vendedor_Key)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Dim_Tiempo')
CREATE TABLE dw.Dim_Tiempo (
    Fecha_Key   INT  NOT NULL,   -- YYYYMMDD
    Fecha       DATE NOT NULL,
    Anio        INT  NOT NULL,
    Mes         INT  NOT NULL,
    Dia         INT  NOT NULL,
    Trimestre   INT  NOT NULL,
    Nombre_Mes  VARCHAR(20) NOT NULL,
    PRIMARY KEY (Fecha_Key)
);
GO

-- Grain: one row per invoice LINE (Numero_Factura + Reng_Num), not per
-- (cliente, articulo, factura) — the same articulo can appear on multiple
-- renglones of the same invoice with different amounts (confirmed against
-- real data, e.g. doc_num B004411 has co_art 0000014 on both reng_num 2 and 4).
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Fact_Ventas')
CREATE TABLE dw.Fact_Ventas (
    Fecha_Key       INT           NOT NULL,
    Cliente_Key     VARCHAR(20)   NOT NULL,
    Articulo_Key    VARCHAR(30)   NOT NULL,
    Vendedor_Key    VARCHAR(20)   NOT NULL,
    Cantidad        DECIMAL(18,5) NOT NULL DEFAULT 0,
    Monto_Neto_BS   DECIMAL(18,4) NOT NULL DEFAULT 0,
    Tasa_Documento  DECIMAL(21,8) NOT NULL DEFAULT 1,
    Monto_Neto_USD  AS (CASE WHEN Tasa_Documento = 0 THEN 0
                             ELSE Monto_Neto_BS / Tasa_Documento END) PERSISTED,
    Numero_Factura  VARCHAR(20)   NOT NULL,
    Reng_Num        INT           NOT NULL,
    PRIMARY KEY (Fecha_Key, Numero_Factura, Reng_Num)
);
GO

-- Grain: one row per invoice line (Numero_Factura + Reng_Num) — see Fact_Ventas
-- comment above for why articulo can repeat within one invoice.
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Fact_Compras')
CREATE TABLE dw.Fact_Compras (
    Fecha_Key       INT           NOT NULL,
    Proveedor_Key   VARCHAR(20)   NOT NULL,
    Articulo_Key    VARCHAR(30)   NOT NULL,
    Cantidad        DECIMAL(18,5) NOT NULL DEFAULT 0,
    Monto_Neto_BS   DECIMAL(18,4) NOT NULL DEFAULT 0,
    Tasa_Documento  DECIMAL(21,8) NOT NULL DEFAULT 1,
    Monto_Neto_USD  AS (CASE WHEN Tasa_Documento = 0 THEN 0
                             ELSE Monto_Neto_BS / Tasa_Documento END) PERSISTED,
    Numero_Factura  VARCHAR(20)   NOT NULL,
    Reng_Num        INT           NOT NULL,
    PRIMARY KEY (Fecha_Key, Numero_Factura, Reng_Num)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'dw' AND t.name = 'Fact_Movimientos_Inventario')
CREATE TABLE dw.Fact_Movimientos_Inventario (
    Fecha_Key      INT           NOT NULL,
    Articulo_Key   VARCHAR(30)   NOT NULL,
    Almacen_Key    VARCHAR(6)    NOT NULL,
    Tipo_Movimiento VARCHAR(20)  NOT NULL,  -- 'AJUSTE' | 'COMPRA' | 'VENTA' | 'TRASLADO'
    Cantidad       DECIMAL(18,5) NOT NULL DEFAULT 0,  -- signed: + entrada, - salida
    Documento_Origen VARCHAR(20) NOT NULL DEFAULT '',
    PRIMARY KEY (Fecha_Key, Articulo_Key, Almacen_Key, Tipo_Movimiento, Documento_Origen)
);
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- snap — Historical daily snapshots, run nightly before backup.
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'snap' AND t.name = 'Snapshot_CXC')
CREATE TABLE snap.Snapshot_CXC (
    Fecha_Snapshot              DATE          NOT NULL,
    co_cli                      VARCHAR(20)   NOT NULL,
    Monto_Pendiente_BS          DECIMAL(18,4) NOT NULL DEFAULT 0,
    Monto_Pendiente_USD         DECIMAL(18,4) NOT NULL DEFAULT 0,
    Notas_Credito_Sin_Aplicar_USD DECIMAL(18,4) NOT NULL DEFAULT 0,
    Saldo_Neto_Real_USD         AS (Monto_Pendiente_USD - Notas_Credito_Sin_Aplicar_USD) PERSISTED,
    ETL_Timestamp               DATETIME2     NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Snapshot, co_cli)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'snap' AND t.name = 'Snapshot_CXP')
CREATE TABLE snap.Snapshot_CXP (
    Fecha_Snapshot              DATE          NOT NULL,
    co_prov                     VARCHAR(20)   NOT NULL,
    Monto_Pendiente_BS          DECIMAL(18,4) NOT NULL DEFAULT 0,
    Monto_Pendiente_USD         DECIMAL(18,4) NOT NULL DEFAULT 0,
    Notas_Credito_Sin_Aplicar_USD DECIMAL(18,4) NOT NULL DEFAULT 0,
    Saldo_Neto_Real_USD         AS (Monto_Pendiente_USD - Notas_Credito_Sin_Aplicar_USD) PERSISTED,
    ETL_Timestamp               DATETIME2     NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Snapshot, co_prov)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'snap' AND t.name = 'Snapshot_Inventario')
CREATE TABLE snap.Snapshot_Inventario (
    Fecha_Snapshot       DATE          NOT NULL,
    co_art               VARCHAR(30)   NOT NULL,
    co_alma              VARCHAR(6)    NOT NULL,
    Stock_Actual         DECIMAL(18,5) NOT NULL DEFAULT 0,
    Costo_Promedio_BS    DECIMAL(18,4) NOT NULL DEFAULT 0,
    Costo_Promedio_USD   DECIMAL(18,4) NOT NULL DEFAULT 0,
    Valor_Total_USD      AS (Stock_Actual * Costo_Promedio_USD) PERSISTED,
    ETL_Timestamp        DATETIME2     NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (Fecha_Snapshot, co_art, co_alma)
);
GO
