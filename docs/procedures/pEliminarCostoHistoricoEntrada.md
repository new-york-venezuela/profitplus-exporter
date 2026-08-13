# SP: pEliminarCostoHistoricoEntrada
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pEliminarCostoHistoricoEntrada]
*DESCRIPCIÓN	: Elimina un registro del Histórico de Costo de Entrada
*AUTOR			: SOFTECH SISTEMAS
*MODIFICADO POR : SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pEliminarCostoHistoricoEntrada]
    (
      @gDoc_Orig UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        UPDATE
            saCostoHistoricoEntrada
        SET doc_orig = '00000000-0000-0000-0000-000000000000'
        WHERE
            doc_orig = @gDoc_Orig 
	
    END
```
