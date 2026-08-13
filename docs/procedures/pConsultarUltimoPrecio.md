# SP: pConsultarUltimoPrecio
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtMargen`](../tables/saArtMargen.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: [pConsultarUltimoPrecio]
DESCRIPCION	: Consultar los ultimos precios agregados para cada almacen
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 17/06/2010
***************************************************************************************************************/
CREATE PROCEDURE [pConsultarUltimoPrecio] ( @sCodigo CHAR(20) = NULL )
AS 
    BEGIN
        SELECT
            ap.co_alma, ap.co_precio, MAX(desde) AS desde, ar.monto_min, ar.monto_max, ( SELECT TOP ( 1 )
                                                                                            hasta
                                                                                         FROM
                                                                                            saArtPrecio ap1
                                                                                         WHERE
                                                                                            ap1.co_precio = ap.co_precio
                                                                                       ) AS hasta,
            ( SELECT TOP ( 1 )
                monto
              FROM
                saArtPrecio ap1
              WHERE
                ap1.co_precio = ap.co_precio
            ) AS monto
        FROM
            saArtprecio ap
            INNER JOIN saArtMargen ar ON ap.co_art = ar.co_art
                                         AND ap.co_precio = ar.co_precio
        WHERE
            ap.co_art = '@sCodigo'
        GROUP BY
            ap.co_precio, ap.co_alma, ar.monto_min, ar.monto_max
        ORDER BY
            ap.co_precio, ap.co_alma

    END
```
