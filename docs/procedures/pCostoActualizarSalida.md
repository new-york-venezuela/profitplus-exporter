# SP: pCostoActualizarSalida
**Tipo**: Procedimiento
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoActualizarSalida] 
 @RowGuid_Doc_Orig UNIQUEIDENTIFIER,
@strTipo_doc      CHAR(4),
@TipoCosto        CHAR(1) = NULL-- UEPS 
AS
  BEGIN
      SET nocount ON

      -- Almacena los articulos a los que hay que asignarle costos 
      DECLARE @tablaGenerica TABLE
        (
           rowguid_art UNIQUEIDENTIFIER,
           cod_almacen CHAR(6),
           fecha_doc   DATETIME,
           total_art   DECIMAL(18, 5),
           pk_co_art   CHAR(30),
           co_uni      CHAR(6),
           tipo_doc    CHAR(4),
		   tipo        CHAR(1)
        )
      DECLARE @RowGuid_Art UNIQUEIDENTIFIER
      DECLARE @Cod_Almacen CHAR(6)
      DECLARE @Fecha_Doc DATETIME
      DECLARE @Total_Art DECIMAL(18, 5)
      DECLARE @Pk_Co_Art CHAR(30)
      DECLARE @Co_Uni CHAR(6)
      DECLARE @Tipo_Doc CHAR(4)
	  DECLARE @tipo CHAR(1)

      IF ( @TipoCosto IS NULL )
        SELECT @TipoCosto = i_costo_inventario FROM   par_emp

      IF ( @strTipo_doc = 'AJUS' ) --AJUSTES SALIDA 
        BEGIN
            INSERT @tablaGenerica
                   (rowguid_art,
                    cod_almacen,
                    total_art,
                    fecha_doc,
                    pk_co_art,
                    co_uni,
                    tipo_doc, tipo)
            SELECT saarticulo.rowguid,
                   saajustereng.co_alma,
                   saajustereng.total_art,
                   saajuste.fecha,
                   saajustereng.co_art,
                   saajustereng.co_uni,
                   'AJUS',saarticulo.tipo
            FROM   saajustereng
                   INNER JOIN saarticulo
                           ON saarticulo.co_art = saajustereng.co_art
                   INNER JOIN saajuste
                           ON saajuste.ajue_num = saajustereng.ajue_num
                              AND saajuste.anulado = 0
                   INNER JOIN satipoajuste
                           ON satipoajuste.tipo_trans = '1'
                              AND satipoajuste.co_tipo = saajustereng.co_tipo
            WHERE  saajustereng.rowguid = @RowGuid_Doc_Orig
        END
      ELSE IF ( @strTipo_doc = 'TRAS' ) --TRASLADO ENTRE ALMACENES 
        BEGIN
            INSERT @tablaGenerica
                   (rowguid_art,
                    cod_almacen,
                    total_art,
                    fecha_doc,
                    pk_co_art,
                    co_uni,
```
