# SP: pObtenerEntradasUtilizadasTipoInventario
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerCostoTipoInventario]
DESCRIPCION: Obtiene las entradas asociadas a un renglón de una salida por
			 tipo de Inventario: UEPS, PEPS
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerEntradasUtilizadasTipoInventario]
    (
      @gDoc_Orig UNIQUEIDENTIFIER
	
    )
AS 
    BEGIN	

        DECLARE @iCosto_Inventario INT
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @TempTable TABLE
            (
              [cod_costo_historico_salida] UNIQUEIDENTIFIER ,
              [cantidad_salida] DECIMAL(18, 5) ,
              [cod_costo_historico_entrada] UNIQUEIDENTIFIER ,
              [cod_articulo_rowguid] UNIQUEIDENTIFIER ,
              [cod_almacen] CHAR(6) ,
              [tipo_doc] CHAR(4) ,
              [doc_orig] UNIQUEIDENTIFIER ,
              [cantidad] DECIMAL(18, 5) ,
              [cantidad_usada] DECIMAL(18, 5) ,
              [costo] DECIMAL(18, 5) ,
              [fecha_registro] DATETIME ,
              [fecha_emision] DATETIME ,
              [fecha_recepcion] DATETIME ,
              [reng_num] DECIMAL(18, 5) ,
              [validador] DATETIME
            )

        SELECT
            @iCosto_Inventario = i_costo_inventario
        FROM
            par_emp

        IF ( @iCosto_Inventario = 3 )--UEPS
            BEGIN
		
                INSERT  INTO @TempTable
                        SELECT
                            s.cod_costo_historico_salida, s.cantidad, e.cod_costo_historico_entrada,
                            e.[cod_articulo_rowguid], e.[cod_almacen], e.[tipo_doc], e.[doc_orig], e.[cantidad],
                            e.[cantidad_usada], e.[costo], e.[fecha_registro], e.[fecha_emision], e.[fecha_recepcion],
                            e.[RengNum], e.[validador]
                        FROM
                            saCostoHistoricoSalida s
                            INNER JOIN saCostoHistoricoEntrada e ON ( e.cod_costo_historico_entrada = s.cod_costo_historico_entrada )
                        WHERE
                            s.doc_orig = @gDoc_Orig
                        ORDER BY
                            e.validador ASC
			
            END

        IF ( @iCosto_Inventario = 2 )--PEPS
            BEGIN
```
