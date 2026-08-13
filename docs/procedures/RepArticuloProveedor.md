# SP: RepArticuloProveedor
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <13-04-10>
 Description:	<Articulos con sus Proveedores>
 =============================================*/
CREATE PROCEDURE [RepArticuloProveedor]
	-- Add the parameters for the stored procedure here
    @sCo_ArtProv_d CHAR(30) = NULL ,
    @sCo_ArtProv_h CHAR(30) = NULL ,
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
            AP.*, LA.co_lin, SL.co_subl, CA.co_cat, ART.art_des, ART.modelo, PR.prov_des
        FROM
            saArtProveedorReng AS AP
            INNER JOIN saArticulo AS ART ON ART.co_art = AP.co_art
            INNER JOIN saProveedor AS PR ON PR.co_prov = AP.co_prov
            INNER JOIN saLineaArticulo AS LA ON ART.co_lin = LA.co_lin
            INNER JOIN saSublinea AS SL ON ART.co_lin = SL.co_lin
                                           AND ART.co_subl = SL.co_subl
            INNER JOIN saCatArticulo AS CA ON ART.co_cat = CA.co_cat
        WHERE
            ( ( @sCo_ArtProv_d IS NULL
                OR AP.co_art >= @sCo_ArtProv_d
              )
              AND ( @sCo_ArtProv_d IS NULL
                    OR AP.co_art <= @sCo_ArtProv_d
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
                  OR AP.co_sucu_in = @sCo_Sucursal
                )
        ORDER B
```
