# SP: RepTotalPedidoxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Pedidos por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalPedidoxArticulo]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

        SET @sOperacion = 'pedi'

        SELECT
            @sOperacion AS Operacion, PV.doc_num, PV.descrip, PV.co_cli, PV.co_tran, PV.co_mone, PV.co_ven, PV.co_cond,
            PV.fec_emis, PV.fec_venc, PV.fec_reg, PV.anulado, PV.status, PV.n_control, PV.ven_ter, PV.tasa,
            PV.porc_desc_glob, ( CASE WHEN PV.anulado = 1 THEN 0.00
                                      ELSE PV.monto_desc_glob
                                 END ) AS monto_desc_glob, PV.porc_reca, ( CASE WHEN PV.anulado = 1 THEN 0.00
                                                                                ELSE PV.monto_reca
                                                                           END ) AS monto_reca,
            ( CASE WHEN PV.anulado = 1 THEN 0.00
                   ELSE PV.total_bruto
              END ) AS total_bruto, ( CASE WHEN PV.anulado = 1 THEN 0.00
                                           ELSE PVR.monto_imp
                                      END ) AS monto_imp, PV.monto_imp2, PV.monto_imp3,
            ( CASE WHEN PV.anulado = 1 THEN 0.00
                   ELSE PVR.otros1
              END ) AS otros1, ( CASE WHEN PV.anulado = 1 THEN 0.00
                                      ELSE PVR.otros2
                                 END ) AS otros2, ( CASE WHEN PV.anulado = 1 THEN 0.00
                                                         ELSE PVR.otros3
```
