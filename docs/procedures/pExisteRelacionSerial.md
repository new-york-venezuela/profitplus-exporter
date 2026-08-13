# SP: pExisteRelacionSerial
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pExisteRelacionSerial
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Verifica si un articulo posee registros en la tabla de seriales
************************************************************************************************/


CREATE PROCEDURE [pExisteRelacionSerial] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
	
        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        *
                    FROM
                        saSeriales
                    WHERE
                        co_art = @sCo_Art ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste

    END
```
