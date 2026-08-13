# SP: pConsultarStock
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarStock]
*DESCRIPCIÓN	: Calcula el stock para un determinado articulo
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-09-14
*ACTUALIZACION	: 2010-01-15
**************************************************************************/

CREATE PROCEDURE [pConsultarStock]
    (
      @pco_art CHAR(30) = NULL ,
      @pco_alma CHAR(6) = NULL
    )
AS 
    BEGIN	
        SELECT
            PVTSTOCK.CO_ART, '' AS CO_ALMA, 'TODOS' AS DESC_ALMA, ISNULL(ArtUnidadP.co_uni, '') AS UNIDAD,
            ISNULL(UnidadP.des_uni, '') AS DESCRIPCION, ISNULL([ACT], 0) AS STOCK_ACT, ISNULL([COM], 0) AS STOCK_COM,
            ISNULL([LLE], 0) AS STOCK_LLE, ISNULL([DES], 0) AS STOCK_DES, ISNULL(ArtUnidadS.co_uni, '') AS UNIDADS,
            ISNULL(UnidadS.des_uni, '') AS DESCRIPCIONS, ISNULL([SACT], 0) AS SSTOCK_ACT,
            ISNULL([SCOM], 0) AS SSTOCK_COM, ISNULL([SLLE], 0) AS SSTOCK_LLE, ISNULL([SDES], 0) AS SSTOCK_DES,
            ISNULL(ArtUnidadp.relacion, 0)
        FROM
            ( SELECT
                saArticulo.co_art CO_ART, SUM(saStockAlmacen.stock) AS stock, saStockAlmacen.tipo AS tipo
              FROM
                saArticulo
                LEFT JOIN saStockAlmacen ON saArticulo.co_art = saStockAlmacen.co_art
              WHERE
                saArticulo.co_art = @pco_art
              GROUP BY
                saArticulo.co_art, saStockAlmacen.tipo
            ) pstockact PIVOT ( SUM(stock) FOR tipo IN ( [ACT], [LLE], [COM], [DES], [SACT], [SLLE], [SCOM], [SDES] ) ) 
			AS PVTSTOCK
            LEFT JOIN saArtUnidad ArtUnidadP ON ArtUnidadP.co_art = PVTSTOCK.CO_ART
                                                AND ArtUnidadP.uni_principal = 1
            LEFT JOIN saUnidad UnidadP ON ArtUnidadP.co_uni = UnidadP.co_uni
            LEFT JOIN saArtUnidad ArtUnidadS ON ArtUnidadS.co_art = PVTSTOCK.CO_ART
                                                AND ArtUnidadS.uni_secundaria = 1
            LEFT JOIN saUnidad UnidadS ON ArtUnidadS.co_uni = UnidadS.co_uni
    END
```
