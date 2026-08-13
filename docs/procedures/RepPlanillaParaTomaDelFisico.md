# SP: RepPlanillaParaTomaDelFisico
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<22-03-11>
 Description:	<Planilla para toma del Fisico>
 =============================================*/
CREATE PROCEDURE [RepPlanillaParaTomaDelFisico]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Color_d CHAR(6) = NULL ,
    @sCo_Color_h CHAR(6) = NULL ,
    @sCo_Alma CHAR(6) = NULL ,
    @sTipoStock CHAR(4) = NULL ,
    @sCo_NivelStock CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_NivelStock IS NULL ) 
            SET @sCo_NivelStock = 'TODO'

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_art'

        SELECT
            A.co_art, A.art_des, AU.co_uni
        FROM
            saArticulo A
            CROSS JOIN saAlmacen AS AL
            LEFT JOIN saStockAlmacen B ON ( ( A.co_art = B.co_art )
                                            AND ( B.tipo = @sTipoStock )
                                            AND ( AL.co_alma = B.co_alma )
                                          )
            LEFT JOIN saArtUnidad AU ON ( ( A.co_art = AU.co_art )
                                          AND ( AU.uni_principal = 1 )
                                        )
            INNER JOIN saLineaArticulo AS LA ON LA.co_lin = A.co_lin
            INNER JOIN saCatArticulo AS CA ON CA.co_cat = A.co_cat
            INNER JOIN saColor AS CO ON CO.co_color = A.co_color
        WHERE
            ( ( @sCo_Art_d IS NULL
                OR A.co_art >= @sCo_Art_d
              )
              AND ( @sCo_Art_h IS NULL
                    OR A.co_art <= @sCo_Art_h
                  )
            )
            AND ( ( @sCo_Linea_d IS NULL
                    OR LA.co_lin >= @sCo_Linea_d
                  )
                  AND ( @sCo_Linea_h IS NULL
                        OR LA.co_lin <= @sCo_Linea_h
                      )
                )
            AND ( ( @sCo_Categoria_d IS NULL
                    OR CA.co_cat >= @sCo_Categoria_d
```
