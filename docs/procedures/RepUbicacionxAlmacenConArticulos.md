# SP: RepUbicacionxAlmacenConArticulos
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
-- Create date: <08-06-2016>
-- Description:	<Listar los artículos agrupados por almacén con sus ubicaciones>
-- =============================================
CREATE PROCEDURE [dbo].[RepUbicacionxAlmacenConArticulos]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
	@sCo_Art_h CHAR (30) = NULL ,	
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
            AU.co_art, AU.co_alma, Al.des_alma, AU.co_ubicacion, AU.co_ubicacion2, AU.co_ubicacion3, AU.orden,
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
			( ( @sCo_Alma_d IS NULL
                OR @sCo_Alma_d <= AU.co_alma
              )
              AND ( @sCo_Alma_h IS NULL
                    OR AU.co_alma <= @sCo_Alma_h
                  )
            )
			AND
			( ( @sCo_Ubic_d IS NULL
                OR @sCo_Ubic_d <= AU.co_ubicacion
              )
              AND ( @sCo_Ubic_h IS NULL
                    OR AU.co_ubicacion <= @sCo_Ubic_h
                  )
            )
			AND
			( ( @sCo_Ubic2_d IS NULL
                OR @sCo_Ubic2_d <= AU.co_ubicacion2
              )
              AND ( @sCo_Ubic2_h IS NULL
                    OR AU.co_ubicacion2 <= @sCo_Ubic2_h
                  )
            )
			AND
			( ( @sCo_Ubic3_d IS NULL
                OR @sCo_Ubic3_d <= AU.co_ubicacion3
              )
              AN
```
