# SP: pObtenerClientesFactLoteGen
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerCliFactLoteGen
*DESCRIPCIÓN	: Obtiene Clientes para el proceso FactLoteGen
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerClientesFactLoteGen]
    (
      @sco_fact_lote_gen char(6)  	  

    )
AS 
    BEGIN	

		DECLARE @CO_CLID VARCHAR(16), @CO_CLIH VARCHAR(16)
		
		SELECT @CO_CLID = co_cli_d, @CO_CLIH = co_cli_h FROM STGFACTLOTEGEN WHERE co_fact_lote_gen = @sco_fact_lote_gen

		SELECT co_cli from SACLIENTE WHERE   ( @CO_CLID IS NULL
                    OR co_cli >= @CO_CLID
                  )
                  AND ( @CO_CLIH IS NULL
                        OR co_cli <= @CO_CLIH
                      )
                

    END
```
