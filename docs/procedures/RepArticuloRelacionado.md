# SP: RepArticuloRelacionado
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtRelacionadoReng`](../tables/saArtRelacionadoReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <09-03-10>
 Description:	<Articulos con sus Relacionados>
 =============================================*/
CREATE PROCEDURE [RepArticuloRelacionado]
-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_SLinea_d CHAR(6) = NULL ,
    @sCo_SLinea_h CHAR(6) = NULL ,
    @sCo_Categ_d CHAR(6) = NULL ,
    @sCo_Categ_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
        SELECT
            AR.*, LA.co_lin, SL.co_subl, CA.co_cat, ART.art_des, B.stock AS StockActual, ART1.art_des AS des_art_rel,
            ISNULL(SA.stock, 0) AS stock_rel, ART1.co_art AS co_art_rel
        FROM
            saArtRelacionadoReng AS AR
            INNER JOIN saArticulo AS ART ON ART.co_art = AR.co_art
            INNER JOIN saArticulo AS ART1 ON ART1.co_art = AR.cod_relac
            INNER JOIN saLineaArticulo AS LA ON ART.co_lin = LA.co_lin
            INNER JOIN saSublinea AS SL ON ART.co_lin = SL.co_lin
                                           AND ART.co_subl = SL.co_subl
            INNER JOIN saCatArticulo AS CA ON ART.co_cat = CA.co_cat
            LEFT JOIN V_saStockActual B ON ART.co_art = B.co_art
                                           AND B.tipo = 'ACT'
            LEFT JOIN V_saStockActual SA ON ART1.co_art = SA.co_art
                                            AND B.tipo = 'ACT'
        WHERE
            ( ( @sCo_Art_d IS NULL
                OR AR.co_art >= @sCo_Art_d
              )
              AND ( @sCo_Art_h IS NULL
                    OR AR.co_art <= @sCo_Art_h
                  )
            )
            AND ( ( @sCo_Linea_d IS NULL
                    OR ART.co_lin >= @sCo_Linea_d
                  )
                  AND ( @sCo_Linea_h IS NULL
                        OR ART.co_lin <= @sCo_Linea_h
                      )
                )
            AND ( ( @sCo_SLinea_d IS NULL
                    OR ART.co_subl >= @sCo_SLinea_d
                  )
                  AND ( @sCo_SLinea_h IS NULL
                        OR ART.co_subl <= @sCo_SLinea_h
                      )
                )
            AND ( ( @sCo_Categ_d IS NULL
```
