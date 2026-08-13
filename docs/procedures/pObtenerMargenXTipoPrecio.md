# SP: pObtenerMargenXTipoPrecio
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 01-02-2010
-- Description:	Obtiene el margen asociado para un articulo y precio
-- =============================================
CREATE PROCEDURE [pObtenerMargenXTipoPrecio]
    (
      @sCo_Precio VARCHAR(6) ,
      @sCo_Articulo VARCHAR(30)
    )
AS 
    BEGIN

        SELECT
            monto_min, monto_max
        FROM
            saArtMargen
        WHERE
            co_art = @sCo_Articulo
            AND co_precio = @sCo_Precio

    END
```
