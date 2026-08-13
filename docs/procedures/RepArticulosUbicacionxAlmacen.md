# SP: RepArticulosUbicacionxAlmacen
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUbicacion`](../tables/saArtUbicacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <07-06-2016>
-- Description:	<Listar los artículos por ubicación en almacenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepArticulosUbicacionxAlmacen]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
	@sCo_Art_h CHAR (30) = NULL ,
	@sCo_Lin_d CHAR (6) = NULL ,
	@sCo_Lin_h CHAR (6) = NULL ,
	@sCo_SubL_d CHAR (6) = NULL ,
	@sCo_SubL_h CHAR (6) = NULL ,
	@sCo_Cat_d CHAR (6) = NULL ,
	@sCo_Cat_h CHAR (6) = NULL ,
	@sCo_Alma_d CHAR (6) = NULL ,
	@sCo_Alma_h CHAR (6) = NULL ,
	@sCo_Ubic_d CHAR (6) = NULL ,
	@sCo_Ubic_h CHAR (6) = NULL ,
	@sCo_Ubic2_d CHAR (6) = NULL ,
	@sCo_Ubic2_h CHAR (6) = NULL ,
	@sCo_Ubic3_d CHAR (6) = NULL ,
	@sCo_Ubic3_h CHAR (6) = NULL ,
	@sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            AU.co_art, AU.co_alma, AU.co_ubicacion, AU.co_ubicacion2, AU.co_ubicacion3, AU.orden,
			Art.art_des, Ub1.des_ubicacion, Ub2.des_ubicacion, Ub3.des_ubicacion
        FROM
            saArtUbicacion AS AU
			JOIN saArticulo AS Art
			ON AU.co_art = Art.co_art
			LEFT JOIN saUbicacion AS Ub1
			ON AU.co_ubicacion = Ub1.co_ubicacion
			LEFT JOIN saUbicacion AS Ub2
			ON AU.co_ubicacion2 = Ub2.co_ubicacion
			LEFT JOIN saUbicacion AS Ub3
			ON AU.co_ubicacion3 = Ub3.co_ubicacion
			JOIN saAlmacen AS Al
			ON Al.co_alma = AU.co_alma
        WHERE

			( ( @sCo_Art_d IS NULL
                OR @sCo_Art_d <= AU.co_art
              )
              AND ( @sCo_Art_h IS NULL
                    OR AU.co_art <= @sCo_Art_h
                  )
            )

			AND

			( ( @sCo_Lin_d IS NULL
                OR @sCo_Lin_d <= Art.co_lin
              )
              AND ( @sCo_Lin_h IS NULL
                    OR Art.co_lin <= @sCo_Lin_h
                  )
            )

			AND

			( ( @sCo_SubL_d IS NULL
                OR @sCo_SubL_d <= Art.co_subl
              )
              AND ( @sCo_SubL_h IS NULL
                    OR Art.co_subl <= @sCo_SubL_h
                  )
            )

			AND

			( ( @sCo_Cat_d IS NULL
                OR @sCo_Cat_d <= Art.co_cat
              )
              AND ( @sCo_Cat_h IS NULL
                    OR Art.co_cat <= @sCo_Cat_h
                  )
```
