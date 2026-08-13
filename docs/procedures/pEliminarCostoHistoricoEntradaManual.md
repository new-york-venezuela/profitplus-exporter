# SP: pEliminarCostoHistoricoEntradaManual
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pEliminarCostoHistoricoEntradaManual]
*DESCRIPCIÓN	: Elimina un costo de tipo manual del Histórico de Costo de Entrada
*AUTOR			: SOFTECH SISTEMAS
*Create Date    : 2011-12-12
*LastUpdate Date: 2018-02-22
**************************************************************************/

CREATE PROCEDURE [pEliminarCostoHistoricoEntradaManual]
    (
      @gCod_Costo_Historico_Entrada UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
	   DELETE FROM saCostoHistoricoEntrada
       WHERE
            cod_costo_historico_entrada = @gCod_Costo_Historico_Entrada  

    END
```
