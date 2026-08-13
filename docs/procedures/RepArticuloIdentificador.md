# SP: RepArticuloIdentificador
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtIdentificadorReng`](../tables/saArtIdentificadorReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <13-04-10>
 Description:	<Articulos con sus Identificadores>
 =============================================*/
CREATE PROCEDURE [RepArticuloIdentificador]
	-- Add the parameters for the stored procedure here
    @sCo_ArtIdent_d CHAR(30) = NULL ,
    @sCo_ArtIdent_h CHAR(30) = NULL ,
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
            AI.*, LA.co_lin, SL.co_subl, CA.co_cat, ART.art_des, ART.modelo
        FROM
            saArtIdentificadorReng AS AI
            INNER JOIN saArticulo AS ART ON ART.co_art = AI.co_art
            INNER JOIN saLineaArticulo AS LA ON ART.co_lin = LA.co_lin
            INNER JOIN saSublinea AS SL ON ART.co_lin = SL.co_lin
                                           AND ART.co_subl = SL.co_subl
            INNER JOIN saCatArticulo AS CA ON ART.co_cat = CA.co_cat
        WHERE
            ( ( @sCo_ArtIdent_d IS NULL
                OR AI.co_art >= @sCo_ArtIdent_d
              )
              AND ( @sCo_ArtIdent_h IS NULL
                    OR AI.co_art <= @sCo_ArtIdent_h
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
                    OR ART.co_cat >= @sCo_Categ_d
                  )
                  AND ( @sCo_Categ_h IS NULL
                        OR ART.co_cat <= @sCo_Categ_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR AI.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE
```
