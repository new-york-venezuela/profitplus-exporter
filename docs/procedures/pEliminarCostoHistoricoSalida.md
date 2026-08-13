# SP: pEliminarCostoHistoricoSalida
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pEliminarCostoHistoricoEntrada]
*DESCRIPCIÓN	: Elimina un registro del Histórico de Costo de Salida
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO POR : SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pEliminarCostoHistoricoSalida]
    (
      @gCod_Costo_Historico_Salida UNIQUEIDENTIFIER = DEFAULT ,
      @gDoc_Orig UNIQUEIDENTIFIER ,
      @bBorrado_Individual BIT
    )
AS 
    BEGIN	

        DECLARE @Table TABLE
            (
              cod_costo_historico_entrada UNIQUEIDENTIFIER ,
              cantidad DECIMAL
            )

        IF ( @bBorrado_Individual = 0 ) 
            BEGIN
                UPDATE
                    saCostoHistoricoSalida
                SET doc_orig = NULL
                OUTPUT
                    deleted.cod_costo_historico_entrada, deleted.cantidad
                    INTO @Table
                WHERE
                    doc_orig = @gDoc_Orig 

            END
        ELSE 
            BEGIN
                UPDATE
                    saCostoHistoricoSalida
                SET doc_orig = NULL
                OUTPUT
                    deleted.cod_costo_historico_entrada, deleted.cantidad
                    INTO @Table
                WHERE
                    doc_orig = @gDoc_Orig
                    AND cod_costo_historico_salida = @gCod_Costo_Historico_Salida
		
            END

        SELECT
            *
        FROM
            @Table
			
    END
```
