-- DW_Profit — Analytics views by business domain.
-- These views expose curated subsets of dw/ops/snap for the App Backend to
-- query directly and layer its own auth/role filtering on top (this SQL
-- layer does not implement row-level security — it defines WHAT each domain
-- is allowed to see; the app enforces WHO sees it).
--
-- Domains: Almacén (warehouse/inventory), Finanzas (cash flow, CXC/CXP,
-- retentions), Ventas (sales performance, commissions, morosos), Dirección
-- (consolidated P&L view spanning all domains).
--
-- Run after ddl/01_dw_profit_schema.sql.

USE DW_Profit;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'rbac')
    EXEC('CREATE SCHEMA rbac');
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- Almacén — stock levels, reorder alerts, inventory valuation
-- ═══════════════════════════════════════════════════════════════════════════

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_almacen_stock')
    DROP VIEW rbac.vw_almacen_stock;
GO
CREATE VIEW rbac.vw_almacen_stock AS
SELECT
    st.co_art,
    a.Articulo_Des,
    st.co_alma,
    st.Stock_Actual,
    st.Stock_Minimo,
    st.Stock_Maximo,
    st.Sync_Timestamp
FROM ops.Stock st
LEFT JOIN dw.Dim_Articulo a ON st.co_art = a.Articulo_Key;
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_almacen_alertas_reorden')
    DROP VIEW rbac.vw_almacen_alertas_reorden;
GO
CREATE VIEW rbac.vw_almacen_alertas_reorden AS
SELECT
    ar.co_art,
    a.Articulo_Des,
    ar.co_alma,
    ar.Stock_Actual,
    ar.Stock_Minimo,
    ar.Deficit
FROM ops.AlertasReorden ar
LEFT JOIN dw.Dim_Articulo a ON ar.co_art = a.Articulo_Key;
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_almacen_valuacion_inventario')
    DROP VIEW rbac.vw_almacen_valuacion_inventario;
GO
CREATE VIEW rbac.vw_almacen_valuacion_inventario AS
SELECT
    si.Fecha_Snapshot,
    si.co_art,
    a.Articulo_Des,
    si.co_alma,
    si.Stock_Actual,
    si.Costo_Promedio_BS,
    si.Costo_Promedio_USD,
    si.Valor_Total_USD
FROM snap.Snapshot_Inventario si
LEFT JOIN dw.Dim_Articulo a ON si.co_art = a.Articulo_Key
WHERE si.Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_Inventario);
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_almacen_ajustes_recientes')
    DROP VIEW rbac.vw_almacen_ajustes_recientes;
GO
CREATE VIEW rbac.vw_almacen_ajustes_recientes AS
SELECT
    aj.Ajuste_Id, aj.co_art, a.Articulo_Des, aj.co_alma, aj.Tipo_Ajuste,
    aj.Cantidad, aj.Motivo, aj.Usuario, aj.Fecha, aj.Profit_Ajue_Num
FROM ops.Ajustes aj
LEFT JOIN dw.Dim_Articulo a ON aj.co_art = a.Articulo_Key;
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- Finanzas — cash flow, CXC/CXP, SENIAT retentions
-- ═══════════════════════════════════════════════════════════════════════════

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_finanzas_cxc_actual')
    DROP VIEW rbac.vw_finanzas_cxc_actual;
GO
CREATE VIEW rbac.vw_finanzas_cxc_actual AS
SELECT
    cxc.Fecha_Snapshot, cxc.co_cli, cl.Cliente_Des, cl.RIF,
    cxc.Monto_Pendiente_BS, cxc.Monto_Pendiente_USD,
    cxc.Notas_Credito_Sin_Aplicar_USD, cxc.Saldo_Neto_Real_USD
FROM snap.Snapshot_CXC cxc
LEFT JOIN dw.Dim_Cliente cl ON cxc.co_cli = cl.Cliente_Key
WHERE cxc.Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXC);
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_finanzas_cxp_actual')
    DROP VIEW rbac.vw_finanzas_cxp_actual;
GO
CREATE VIEW rbac.vw_finanzas_cxp_actual AS
SELECT
    cxp.Fecha_Snapshot, cxp.co_prov,
    cxp.Monto_Pendiente_BS, cxp.Monto_Pendiente_USD,
    cxp.Notas_Credito_Sin_Aplicar_USD, cxp.Saldo_Neto_Real_USD
FROM snap.Snapshot_CXP cxp
WHERE cxp.Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXP);
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_finanzas_cxc_evolucion')
    DROP VIEW rbac.vw_finanzas_cxc_evolucion;
GO
CREATE VIEW rbac.vw_finanzas_cxc_evolucion AS
SELECT
    Fecha_Snapshot, co_cli,
    Monto_Pendiente_USD, Notas_Credito_Sin_Aplicar_USD, Saldo_Neto_Real_USD
FROM snap.Snapshot_CXC;
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- Ventas — sales performance, vendedor breakdown, clientes morosos
-- ═══════════════════════════════════════════════════════════════════════════

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_ventas_por_vendedor')
    DROP VIEW rbac.vw_ventas_por_vendedor;
GO
CREATE VIEW rbac.vw_ventas_por_vendedor AS
SELECT
    fv.Fecha_Key, dt.Fecha, dt.Anio, dt.Mes,
    fv.Vendedor_Key, dv.Vendedor_Des,
    COUNT(DISTINCT fv.Numero_Factura) AS Num_Facturas,
    SUM(fv.Monto_Neto_BS) AS Monto_Neto_BS,
    SUM(fv.Monto_Neto_USD) AS Monto_Neto_USD
FROM dw.Fact_Ventas fv
LEFT JOIN dw.Dim_Vendedor dv ON fv.Vendedor_Key = dv.Vendedor_Key
LEFT JOIN dw.Dim_Tiempo dt ON fv.Fecha_Key = dt.Fecha_Key
GROUP BY fv.Fecha_Key, dt.Fecha, dt.Anio, dt.Mes, fv.Vendedor_Key, dv.Vendedor_Des;
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_ventas_por_cliente')
    DROP VIEW rbac.vw_ventas_por_cliente;
GO
CREATE VIEW rbac.vw_ventas_por_cliente AS
SELECT
    fv.Cliente_Key, dc.Cliente_Des,
    COUNT(DISTINCT fv.Numero_Factura) AS Num_Facturas,
    SUM(fv.Monto_Neto_BS) AS Monto_Neto_BS,
    SUM(fv.Monto_Neto_USD) AS Monto_Neto_USD
FROM dw.Fact_Ventas fv
LEFT JOIN dw.Dim_Cliente dc ON fv.Cliente_Key = dc.Cliente_Key
GROUP BY fv.Cliente_Key, dc.Cliente_Des;
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_ventas_clientes_morosos')
    DROP VIEW rbac.vw_ventas_clientes_morosos;
GO
CREATE VIEW rbac.vw_ventas_clientes_morosos AS
SELECT
    cxc.co_cli, cl.Cliente_Des, cl.Vendedor_Key, dv.Vendedor_Des,
    cxc.Saldo_Neto_Real_USD
FROM snap.Snapshot_CXC cxc
LEFT JOIN dw.Dim_Cliente cl ON cxc.co_cli = cl.Cliente_Key
LEFT JOIN dw.Dim_Vendedor dv ON cl.Vendedor_Key = dv.Vendedor_Key
WHERE cxc.Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXC)
  AND cxc.Saldo_Neto_Real_USD > 0;
GO


-- ═══════════════════════════════════════════════════════════════════════════
-- Dirección — consolidated cross-domain view for executive reporting
-- ═══════════════════════════════════════════════════════════════════════════

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_direccion_resumen_mensual')
    DROP VIEW rbac.vw_direccion_resumen_mensual;
GO
CREATE VIEW rbac.vw_direccion_resumen_mensual AS
SELECT
    dt.Anio, dt.Mes,
    SUM(fv.Monto_Neto_USD) AS Ventas_Netas_USD,
    COUNT(DISTINCT fv.Numero_Factura) AS Num_Facturas,
    COUNT(DISTINCT fv.Cliente_Key) AS Num_Clientes_Activos
FROM dw.Fact_Ventas fv
LEFT JOIN dw.Dim_Tiempo dt ON fv.Fecha_Key = dt.Fecha_Key
GROUP BY dt.Anio, dt.Mes;
GO

IF EXISTS (SELECT 1 FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
           WHERE s.name = 'rbac' AND v.name = 'vw_direccion_posicion_financiera')
    DROP VIEW rbac.vw_direccion_posicion_financiera;
GO
CREATE VIEW rbac.vw_direccion_posicion_financiera AS
SELECT
    (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXC) AS Fecha_Snapshot,
    (SELECT SUM(Saldo_Neto_Real_USD) FROM snap.Snapshot_CXC
     WHERE Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXC)) AS Total_CXC_USD,
    (SELECT SUM(Saldo_Neto_Real_USD) FROM snap.Snapshot_CXP
     WHERE Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_CXP)) AS Total_CXP_USD,
    (SELECT SUM(Valor_Total_USD) FROM snap.Snapshot_Inventario
     WHERE Fecha_Snapshot = (SELECT MAX(Fecha_Snapshot) FROM snap.Snapshot_Inventario)) AS Total_Inventario_USD;
GO
