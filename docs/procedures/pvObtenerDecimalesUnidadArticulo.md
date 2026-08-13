# SP: pvObtenerDecimalesUnidadArticulo
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [ObtenerDecimalesUnidadArticulo]
*DESCRIPCIÓN	: Devuelve si en la unidad del artículo tiene una limitación de decimales para cantidad, y la cantidad de decimales
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pvObtenerDecimalesUnidadArticulo] 
    @sCo_Art CHAR(30) = NULL ,
    @sCo_Uni CHAR(6) = NULL 																		
AS 
    BEGIN
        SELECT
            uso_numDecimales,
			num_decimales
        FROM
            saArtUnidad
		WHERE 
			Co_Uni = @sCo_Uni AND Co_Art = @sCo_Art
    END
```
