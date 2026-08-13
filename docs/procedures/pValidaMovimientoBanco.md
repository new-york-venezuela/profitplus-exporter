# SP: pValidaMovimientoBanco
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pValidaMovimientoBanco
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Valida si el movimiento de pago se encuentra conciliado
***********************************************************************************************/

CREATE PROCEDURE [pValidaMovimientoBanco] ( @sMovNumero CHAR(20) )
AS 
    BEGIN
	
        DECLARE @bEsConciliado AS BIT

        SET @bEsConciliado = ( SELECT
                                conciliado
                               FROM
                                saMovimientoBanco
                               WHERE
                                conciliado = 1
                                AND mov_num = @sMovNumero
                             )
		
        SELECT
            @bEsConciliado AS conciliado
	
    END
```
