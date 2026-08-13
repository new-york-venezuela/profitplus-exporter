# SP: pValidarArtCompuestoRecursividad
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarArtCompuestoRecursividad]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER = NULL ,
    @sCo_art CHAR(30) = NULL
AS 
    BEGIN

        DECLARE @intNumNiveles INT

        SET @intNumNiveles = 5 ;

        WITH    ArtCompuestoRecursivo ( co_art_ori, co_art, Nivel )
                  AS ( SELECT
                        saArtCompuesto.co_art AS co_art_ori, saArtCompuestoReng.co_art AS co_art, 0 AS Nivel
                       FROM
                        saArtCompuestoReng
                        INNER JOIN saArtCompuesto ON saArtCompuesto.co_artc = saArtCompuestoReng.co_artc
                       WHERE
                        saArtCompuesto.co_art = @sCo_art
                        OR @sCo_art IS NULL
                       UNION ALL
                       SELECT
                        ArtCompuestoRecursivo.co_art_ori AS co_art_ori, saArtCompuestoReng.co_art AS co_art,
                        ArtCompuestoRecursivo.Nivel + 1 AS Nivel
                       FROM
                        saArtCompuestoReng
                        INNER JOIN saArtCompuesto ON saArtCompuesto.co_artc = saArtCompuestoReng.co_artc
                        INNER JOIN ArtCompuestoRecursivo ON saArtCompuesto.co_art = ArtCompuestoRecursivo.co_art
                       WHERE
                        ArtCompuestoRecursivo.Nivel <= @intNumNiveles - 1
                     )
            SELECT
                'El artículo compuesto "' + RTRIM(co_art_ori) + '" tiene una definición recursiva de más de 10 niveles'
                + ( CASE WHEN @sCo_art IS NULL THEN '" *NC.'
                         ELSE '.'
                    END ) AS motivo
            FROM
                ArtCompuestoRecursivo
            GROUP BY
                co_art_ori
            HAVING
                COUNT(*) > 1
                AND MAX(nivel) = @intNumNiveles
            ORDER BY
                co_art_ori
    END
```
