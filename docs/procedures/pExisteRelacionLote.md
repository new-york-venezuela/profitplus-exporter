# SP: pExisteRelacionLote
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pExisteRelacionLote
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Verifica si un articulo posee registros en la tabla de lotes
************************************************************************************************/

CREATE PROCEDURE [pExisteRelacionLote] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
	
        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        *
                    FROM
                        saLoteEntrada
                    WHERE
                        co_art = @sCo_Art ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste

    END
```
