# SP: pObtenerUltimoCosto
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerUltimoCosto]
DESCRIPCION: Obtiene el ultimo costo para un artículo de un almacén
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerUltimoCosto]
    (
      @gRowguid_Articulo UNIQUEIDENTIFIER ,
      @sCod_Almacen CHAR(6) = NULL ,
      @sdFecha_Desde SMALLDATETIME = NULL ,
      @sdFecha_Hasta SMALLDATETIME = NULL ,
      @sCod_Uni CHAR(6) = NULL ,
      @sTipoCosto CHAR(2) = NULL ,  -- 1 Ultimo, 2 Promedio, 3 Ultimo OM, 4 Promedio OM, 5 Reposicion, 6 Proveedor
      @sCo_Mone CHAR(6) = NULL
	
    )
AS 
    BEGIN	
        DECLARE @Total_ArtUniPrim DECIMAL(18, 5)
	
        IF ( @sTipoCosto IS NULL ) 
            BEGIN
                SELECT
                    @sTipoCosto = tipo_cos
                FROM
                    saArticulo
                WHERE
                    rowguid = @gRowguid_Articulo
            END
	

        IF ( @sCod_Uni IS NOT NULL ) 
            SET @Total_ArtUniPrim = dbo.ArtUnidadBase(( SELECT
                                                            co_art
                                                        FROM
                                                            saArticulo
                                                        WHERE
                                                            rowguid = @gRowguid_Articulo
                                                      ), @sCod_Uni, 1)
		
        IF ( @Total_ArtUniPrim IS NULL ) 
            SET @Total_ArtUniPrim = 1

        SELECT TOP ( 1 )
            cod_costo_historico_entrada, cod_articulo_rowguid, cod_almacen, tipo_doc, doc_orig, cantidad, cantidad_usada,
            ROUND(@Total_ArtUniPrim * CASE WHEN @sTipoCosto = '2' THEN costo_pro
                                           WHEN @sTipoCosto = '4' THEN costo_pro
                                           ELSE costo
                                      END * CASE WHEN @sCo_Mone IS NULL THEN 1
                                                 ELSE 1 / dbo.TasaProceso(e.doc_orig, e.tipo_doc, @sCo_Mone)
                                            END, 5) costo, fecha_emision, 
                                            (CASE e.tipo_doc 
											WHEN 'COMP' THEN (SELECT fc.fec_reg FROM saFacturaCompra  fc W
```
