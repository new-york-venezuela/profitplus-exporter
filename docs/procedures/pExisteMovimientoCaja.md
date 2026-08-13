# SP: pExisteMovimientoCaja
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pExisteMovimientoCaja
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Verifica si existen movimientos asociados a una caja
************************************************************************************************/

CREATE PROCEDURE [pExisteMovimientoCaja] ( @sCo_Caja CHAR(6) )
AS 
    BEGIN
	
        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        *
                    FROM
                        saMovimientoCaja
                    WHERE
                        cod_caja = @sCo_Caja ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste

    END
```
