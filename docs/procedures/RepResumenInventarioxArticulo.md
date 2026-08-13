# SP: RepResumenInventarioxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
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
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/02/2011>
-- Description:	<Resumen de Inventario por Artículo>
-- =============================================
CREATE PROCEDURE [dbo].[RepResumenInventarioxArticulo]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_fecha_d DATETIME = NULL ,
    @sCo_fecha_h DATETIME = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sTipo_Unidad CHAR(4) = NULL , -- (Si es primaria o secundaria)
    @sCo_Movimiento CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

         IF @sCo_Movimiento IS NULL 
            SET @sCo_Movimiento = 'TODO'
 
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = DATEADD(ss, -1, DATEADD(day, 1, @sCo_fecha_h))
	
        SET @sCo_fecha_d = dbo.fechasimple(@sCo_fecha_d)
        SET @sCo_fecha_h = dbo.fechasimple(@sCo_fecha_h)
 
        DECLARE @bObtenerUnidadPrincipal BIT ;
	
        IF ( @sTipo_Unidad IS NULL
             OR @sTipo_Unidad = 'UNPR'
           ) 
            BEGIN
                SET @bObtenerUnidadPrincipal = 1
                SET @sTipo_Unidad = 'UNPR'
            END	
        ELSE 
            SET @bObtenerUnidadPrincipal = 0


		DECLARE @temp1 table(
                [co_art] CHAR(30), 
				[art_des] CHAR(120), 
				[co_uni_base] CHAR(6), 
				[tipo] CHAR(1),
				[TIP] CHAR(4),
				[total_compra]decimal (20,5),
				[total_entrada]decimal (20,5),
				[total_venta]decimal (20,5),
				[total_salida] decimal (20,5),

				 co_uniP1 CHAR(6), 
  equivalenciaP1 varchar(20), 
  relacionP1 CHAR(1),
  usoDecP1 CHAR(1),
  numDecP1 int,
  decripcionP1 varchar(60),

  co_uniP1_1  CHAR(6), 
  equivalenciaP1_1 varchar(20), 
  relacionP1_1 CHAR(1),
  usoDecP1_1 CHAR(1),
  numDecP1_1 int,
  decripcionP1_1 varchar(60),

  co_uniP1_2  CHAR(6), 
  equivalenciaP1_2 varchar(20), 
  relacionP1_2 CHAR(1),
  usoDecP1_2 CHAR(1),
  numDecP1_2 int,
  decripcionP1_2 varchar(60),

  co_uniP1_3  CHAR(6), 
  equivalenciaP1_3 varchar(20), 
  relacionP1_3 CHAR(1),
  usoDecP1_3 CHAR(1),
  numDecP1_3 int,
  decripcionP1_3 varchar(60),

  co_uniP2  CHAR(6), 
  equivalenci
```
