# SP: pSeleccionarRenglonesArtUbicacion
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUbicacion`](../tables/saArtUbicacion.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArtUbicacion
DESCRIPCION: Selecciona las ubicaciones de un artículo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesArtUbicacion] ( @sCo_Art CHAR(30) )
AS 
    BEGIN

        SELECT
            Au.*, Al.co_sucur,
			Al.des_alma AS Des_Alma,
			Ub1.des_ubicacion AS Des_Ubicacion1,
			Ub2.des_ubicacion AS Des_Ubicacion2,
			Ub3.des_ubicacion AS Des_Ubicacion3
        FROM
            saArtUbicacion Au
		INNER JOIN saAlmacen Al ON Au.co_alma = Al.co_alma
		INNER JOIN saUbicacion Ub1 ON Au.co_ubicacion = Ub1.co_ubicacion
		LEFT JOIN saUbicacion Ub2 ON Au.co_ubicacion2 = Ub2.co_ubicacion
		LEFT JOIN saUbicacion Ub3 ON Au.co_ubicacion3 = Ub3.co_ubicacion
        WHERE
            co_art = @sCo_Art

    END
```
