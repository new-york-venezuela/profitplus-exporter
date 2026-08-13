# SP: pv_ObtenerUbicaciones
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUbicacion`](../tables/saArtUbicacion.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ObtenerUbicaciones
*DESCRIPCIÓN	:	OBTIENE LAS UBICACIONES DE UN ARTICULO DADO SEGUN LA SUCURSAL
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerUbicaciones]
    @sCoArticulo	CHAR(30) ,
    @sCoSucursal	CHAR(6)
AS 
    BEGIN

		SELECT

			ROW_NUMBER() OVER (ORDER BY Au.co_art, Al.des_alma, Ub1.des_ubicacion, Ub2.des_ubicacion, Ub3.des_ubicacion, Au.orden) AS Nro,
			Au.co_art, Al.des_alma, Ub1.des_ubicacion AS Ubicacion1, ISNULL(Ub2.des_ubicacion, '') AS Ubicacion2,
			ISNULL(Ub3.des_ubicacion, '') AS Ubicacion3, ISNULL(Au.des_ubicacion, '') AS des_ubicacion, Au.orden

		FROM
			
			saArtUbicacion Au
			INNER JOIN saAlmacen Al ON Au.co_alma = Al.co_alma
			INNER JOIN saUbicacion Ub1 ON Ub1.co_ubicacion = Au.co_ubicacion
			LEFT JOIN saUbicacion Ub2 ON Ub2.co_ubicacion = Au.co_ubicacion2
			LEFT JOIN saUbicacion Ub3 ON Ub3.co_ubicacion = Au.co_ubicacion3

		WHERE

			(Au.co_art = @sCoArticulo)

			AND

			(Al.co_sucur = @sCoSucursal)


    END
```
