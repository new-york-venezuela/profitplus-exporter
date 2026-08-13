# SP: pActualizarCostoHistoricoEntrada
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE : [pActualizarCostoHistoricoEntrada]
*DESCRIPCIÓN : Actualiza un registro de la tabla saCostoHistoricoEntrada
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pActualizarCostoHistoricoEntrada]
    (
      @gCod_Articulo_Rowguid UNIQUEIDENTIFIER ,
      @sCod_Almacen CHAR(6) ,
      @sTipo_Doc CHAR(4) ,
      @gDoc_Orig UNIQUEIDENTIFIER ,
      @deCantidad DECIMAL(18, 5) ,
      @deCosto DECIMAL(18, 5) ,
      @sdFecha_Registro DATETIME , --DN
      @sdFecha_Emision DATETIME ,--DN
      @sdFecha_Recepcion DATETIME ,--DN
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @iValRengNum INT = 0
	
    )
AS 
    BEGIN
        UPDATE
            saCostoHistoricoEntrada
        SET cod_articulo_rowguid = @gCod_Articulo_Rowguid, cod_almacen = @sCod_Almacen, tipo_doc = @sTipo_Doc,
            doc_orig = @gDoc_Orig, cantidad = @deCantidad, costo = @deCosto, fecha_registro = @sdFecha_Registro,
            fecha_emision = @sdFecha_Emision, fecha_recepcion = @sdFecha_Recepcion, RengNum = @iValRengNum
        WHERE
            doc_orig = @gDoc_Orig
            AND tipo_doc = @sTipo_Doc
    END
```
