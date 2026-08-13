# SP: pExisteCompuesto
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pExisteRelacionLote
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Verifica si un articulo posee registros en la tabla de compuesto
************************************************************************************************/

CREATE PROCEDURE [pExisteCompuesto] ( @sCo_Art CHAR(30) )
AS 
    BEGIN
	
        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        *
                    FROM
                        saArtCompuesto
                    WHERE
                        co_art = @sCo_Art ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste

    END
```
