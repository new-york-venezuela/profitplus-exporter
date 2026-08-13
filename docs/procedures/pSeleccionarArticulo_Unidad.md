# SP: pSeleccionarArticulo_Unidad
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticulo
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarArticulo_Unidad] ( @sCo_Art CHAR(30),@co_uni CHAR(6) )
AS 
    BEGIN
        SELECT
            a.tipo,
			isnull((select num_decimales from saArtUnidad where co_art = @sCo_Art and co_uni=@co_uni),0)as decimales
			, 
			isnull((select uso_numDecimales from saArtUnidad where co_art = @sCo_Art and co_uni=@co_uni),0)as uso_NumDecimales
        FROM
            saArticulo a 
        WHERE
            co_art = @sCo_Art
    END
```
