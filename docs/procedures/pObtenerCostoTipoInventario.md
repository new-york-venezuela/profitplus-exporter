# SP: pObtenerCostoTipoInventario
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerCostoTipoInventario]
DESCRIPCION: Obtiene el costo para un artículo de un almacén de acuerdo al
			 tipo de Inventario: UEPS, PEPS
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerCostoTipoInventario]
    (
      @gRowguid_Articulo UNIQUEIDENTIFIER ,
      @sCo_Alma CHAR(6) ,
      @gDoc_Orig UNIQUEIDENTIFIER ,
      @bSin_Incluirme BIT
	
    )
AS 
    BEGIN	

        DECLARE @iCosto_Inventario INT
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @TempTable TABLE
            (
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
              [fecha_recepcion] DATETIME
            )


        SELECT
            @iCosto_Inventario = i_costo_inventario
        FROM
            par_emp

        IF ( @iCosto_Inventario = 3 )--UEPS
            BEGIN
		
                IF ( @bSin_Incluirme = 1 ) 
                    BEGIN
                        INSERT  INTO @TempTable
                                SELECT
                                    cod_costo_historico_entrada, cod_articulo_rowguid, cod_almacen, tipo_doc, doc_orig,
                                    cantidad, cantidad_usada, costo, fecha_registro, fecha_emision, fecha_recepcion
                                FROM
                                    saCostoHistoricoEntrada
                                WHERE
                                    cod_articulo_rowguid = @gRowguid_Articulo
                                    AND cod_almacen = @sCo_Alma
                                    AND ( cantidad - cantidad_usada ) > 0
                                    AND doc_orig <> @gDoc_Orig
                                ORDER BY
                                    fecha_emision DESC 
                    END
                ELSE 
                    BEGIN
                        INSERT  INTO @TempTable
```
