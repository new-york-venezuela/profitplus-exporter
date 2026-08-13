# SP: pExisteArticuloConReferencia
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pExisteArticuloConReferencia
*AUTOR			:		SOFTECH SISTEMAS
*DESCRIPCIÓN	:		Verifica si un articulo Activo posee ya un numero de referencia
************************************************************************************************/
CREATE PROCEDURE [dbo].[pExisteArticuloConReferencia] ( @sCo_Art CHAR(30), @sRef  CHAR(30) = NULL)
AS 
    BEGIN
	
        DECLARE @bExiste BIT
		SET @sRef = NULLIF(LTRIM(RTRIM(@sRef)), '');
        IF EXISTS ( SELECT ref
                    FROM saArticulo
                    WHERE
                       -- co_art = @sCo_Art and  
						ref is not null and ref = @sRef and
						anulado = 0) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste

    END
```
