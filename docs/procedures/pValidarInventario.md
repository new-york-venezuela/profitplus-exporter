# SP: pValidarInventario
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarInventario]
	--@bCorregir bit = 0 -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
AS 
    BEGIN

        DECLARE STOCK_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                co_art
            FROM
                saArticulo
	
        OPEN STOCK_VALIDAR

        DECLARE @pCo_Art CHAR(30)

        FETCH NEXT FROM STOCK_VALIDAR 
INTO @pCo_Art

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC pInsertarArtMargen @pCo_Art

                FETCH NEXT FROM STOCK_VALIDAR 
	INTO @pCo_Art
            END 
        EXEC pInsertarArtMargen @pCo_Art

        CLOSE STOCK_VALIDAR

        DEALLOCATE STOCK_VALIDAR



    END
```
