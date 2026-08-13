# SP: RepMovimientoInventarioxArticuloxSeriales
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08/04/2011>
-- Description:	<Movimientos de Inventarios por Articulo con Seriales>
-- =============================================
CREATE PROCEDURE [dbo].[RepMovimientoInventarioxArticuloxSeriales]
     @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @dCo_fecha_d DATETIME = NULL ,
    @dCo_fecha_h DATETIME = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Movimiento CHAR(4) = NULL ,
    @sCostos CHAR(4) = NULL ,
    @sSerial CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


        IF ( @sCo_Movimiento IS NULL
             OR @sCo_Movimiento = 'TODO'
           ) 
            SET @sCo_Movimiento = NULL

        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = DATEADD(ss, -1, DATEADD(day, 1, @dCo_fecha_h))

        IF @sCostos IS NULL
            OR @sCostos = 'NO' 
            SET @sCostos = NULL

        SET @dCo_fecha_d = dbo.fechasimple(@dCo_fecha_d)
        SET @dCo_fecha_h = dbo.fechasimple(@dCo_fecha_h)

		SELECT
            A.*, B.StockInic, B.StockFinal, CASE WHEN @sCostos = 'SI' THEN '1'
                                                 ELSE '0'
                                            END AS detalle
        FROM
            (	
	--1saFacturaCompraReng
              SELECT
                A.co_art, A.art_des, FCR.total_art, FCR.co_uni, FCR.total * CASE WHEN FC.anulado = 1 THEN 0
                                                                                 ELSE 1
                                                                            END AS total_entrada, 0.00 AS total_salida,
                AU2.co_uni AS co_uni_base, FCR.co_alma, dbo.fechasimple(FC.fec_emis) AS fecha, FCR.reng_num, FCR.doc_num,
                FC.anulado AS anulado, FC.co_prov, '' AS co_cli, 'COMP' AS tipo, ISNULL(VCE.cantidad, 0.00) AS cantidad,
                ISNULL(VCE.costo, 0.00) AS costo, '' AS tipo_doc_c, '' AS nro_doc_c, '' AS fecha_emision_c,
                dbo.ObtenerCostoPromedioPonderado(FCR.rowguid) AS costo_pro, A.tipo AS tipo_art, S.serial
              FROM
                saArticulo AS A
```
