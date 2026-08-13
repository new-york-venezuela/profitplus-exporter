# SP: pConsultarStockxAlmacen
**Tipo**: Consultar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarStockxAlmacen]
*DESCRIPCIÓN	: Calcula el stock por almacen para un determinado articulo
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-09-14
*ACTUALIZAZION	: 2010-01-15
**************************************************************************/

CREATE PROCEDURE [pConsultarStockxAlmacen]
    (
      @pco_art CHAR(30) = NULL ,
      @pco_alma CHAR(6) = NULL
    )
AS 
    BEGIN	
        SELECT
            PVTSTOCK.CO_ART, CO_ALMA, DES_ALMA, ISNULL(ArtUnidadP.co_uni, 'N/A') AS UNIDAD,
            ISNULL(UnidadP.des_uni, 'N/A') AS DESCRIPCION, ISNULL([ACT], 0) AS STOCK_ACT, ISNULL([COM], 0) AS STOCK_COM,
            ISNULL([LLE], 0) AS STOCK_LLE, ISNULL([DES], 0) AS STOCK_DES, ISNULL(ArtUnidadS.co_uni, 'N/A') AS UNIDADS,
            ISNULL(UnidadS.des_uni, 'N/A') AS DESCRIPCIONS, ISNULL([SACT], 0) AS SSTOCK_ACT,
            ISNULL([SCOM], 0) AS SSTOCK_COM, ISNULL([SLLE], 0) AS SSTOCK_LLE, ISNULL([SDES], 0) AS SSTOCK_DES,
            ISNULL(ArtUnidadp.relacion, 0)
        FROM
            ( SELECT
                BASE.CO_ART, BASE.co_alma, BASE.des_alma, stock, saStockAlmacen.tipo AS tipo
              FROM
                ( SELECT
                    saarticulo.co_art, saalmacen.co_alma, saalmacen.des_alma
                  FROM
                    saAlmacen ,
                    saArticulo
                  WHERE
                    saArticulo.co_art = @pco_art
                ) AS BASE
                LEFT JOIN saStockAlmacen ON BASE.co_art = saStockAlmacen.co_art
                                            AND BASE.co_alma = saStockAlmacen.co_alma
            ) pstockact PIVOT ( SUM(stock) FOR tipo IN ( [ACT], [LLE], [COM], [DES], [SACT], [SLLE], [SCOM], [SDES] ) ) AS PVTSTOCK
            LEFT JOIN saArtUnidad ArtUnidadP ON ArtUnidadP.co_art = PVTSTOCK.CO_ART
                                                AND ArtUnidadP.uni_principal = 1
            LEFT JOIN saUnidad UnidadP ON ArtUnidadP.co_uni = UnidadP.co_uni
            LEFT JOIN saArtUnidad ArtUnidadS ON ArtUnidadS.co_art = PVTSTOCK.CO_ART
                                                AND ArtUnidadS.uni_secundaria = 1
            LEFT JOIN saUnidad UnidadS ON ArtUnidadS.co_uni = UnidadS.co_uni
        WHERE
            ( @pco_alma = CO_ALMA
              OR @pco_alma IS NULL
            ) 
    END
```
