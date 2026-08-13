# SP: pObtenerArticuloUnidadPrimaria
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pObtenerArticuloUnidadPrimaria]
DESCRIPCION: 
CREADO POR:		SOFTECH SISTEMAS 
FECHA:			10/11/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerArticuloUnidadPrimaria] ( @sCo_Art CHAR(30) )
AS 
    BEGIN

        DECLARE @UNIDAD BIT

        SET @UNIDAD = ISNULL(( SELECT
                                CASE WHEN ( U.uni_principal = 1 )
                                          AND ( U.uso_principal = 1 ) THEN 1
                                     ELSE 0
                                END AS unidad
                               FROM
                                saArtUnidad AS U
                                INNER JOIN saArticulo AS A ON U.co_art = A.co_art
                                INNER JOIN saUnidad ON U.co_uni = dbo.saUnidad.co_uni
                               WHERE
                                ( U.uni_principal = 1 )
                                AND ( U.uso_principal = 1 )
                                AND A.co_art = @sCo_Art
                             ), 0)
		
        SELECT
            @UNIDAD
    END
```
