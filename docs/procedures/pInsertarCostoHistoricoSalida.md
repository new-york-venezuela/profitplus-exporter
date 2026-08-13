# SP: pInsertarCostoHistoricoSalida
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE : [pInsertarCostoHistoricoSalida]
*DESCRIPCIÓN : Inserta un nuevo registro a la tabla saCostoHistoricoSalida
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [pInsertarCostoHistoricoSalida]
    (
      @gCod_Costo_Historico_Entrada UNIQUEIDENTIFIER ,
      @deCantidad DECIMAL(18, 5) ,
      @gDoc_Orig UNIQUEIDENTIFIER ,
      @sTipo_Doc CHAR(4) ,
      @dtValFecha DATETIME = NULL ,
      @gValCo_Art UNIQUEIDENTIFIER = NULL ,
      @sValCod_Almacen CHAR(6) = NULL

    )
AS 
    BEGIN
        INSERT  INTO saCostoHistoricoSalida
                ( cod_costo_historico_entrada, cantidad, doc_orig, tipo_doc, fecha_emision, cod_articulo_rowguid,
                  Cod_Almacen )
        VALUES
                ( @gCod_Costo_Historico_Entrada, @deCantidad, @gDoc_Orig, @sTipo_Doc, @dtValFecha, @gValCo_Art,
                  @sValCod_Almacen )

    END
```
