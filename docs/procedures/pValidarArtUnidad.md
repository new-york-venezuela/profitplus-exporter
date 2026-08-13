# SP: pValidarArtUnidad
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <2011/12/12>
-- Last Update date: 2017-08-01
-- Description:	<Valida la consistencia del Inventario por las Tablas de Articulos Unidadaes y Articulos Unidades>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarArtUnidad]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN

        SELECT
            'El artículo "' + RTRIM(saArticulo.co_art) + '" no tiene unidad principal asociada *NC.' AS Motivo
        FROM
            saArticulo
        WHERE
            NOT EXISTS ( SELECT
                            *
                         FROM
                            saArtUnidad
                         WHERE
                            saArtUnidad.co_art = saArticulo.co_art
                            AND saArtUnidad.uni_principal = 1 )
							AND saArticulo.anulado = 0
        UNION
        SELECT
            'El artículo "' + RTRIM(saArticulo.co_art) + '" tiene más de una unidad principal asociada *NC.' AS Motivo
        FROM
            saArticulo
            INNER JOIN saArtUnidad ON saArtUnidad.co_art = saArticulo.co_art
                                      AND saArtUnidad.uni_principal = 1
        GROUP BY
            saArticulo.co_art
        HAVING
            COUNT(*) > 1
        UNION
        SELECT
            'El artículo "' + RTRIM(saArticulo.co_art)
            + '" no maneja unidad secundaria y tiene una unidad marcada como secundaria *NC.' AS Motivo
        FROM
            saArticulo
        WHERE
            saArticulo.relac_unidad <> 1
            AND EXISTS ( SELECT
                            *
                         FROM
                            saArtUnidad
                         WHERE
                            saArtUnidad.co_art = saArticulo.co_art
                            AND saArtUnidad.uni_secundaria = 1 )
							AND saArticulo.anulado = 0
        UNION
        SELECT
            'El artículo "' + RTRIM(saArticulo.co_art)
            + '" maneja unidad secundaria y no tiene asignada ninguna unidad secundaria *NC.' AS Motivo
        FROM
            saArticulo
        WHERE
            saArticulo.relac_unidad = 1
            AND NOT EXISTS ( SELECT
                                *
                             FROM
                                saArtUnidad
```
