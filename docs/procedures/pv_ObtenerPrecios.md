# SP: pv_ObtenerPrecios
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ObtenerPrecios
*DESCRIPCIÓN	:	OBTIENE LOS PRECIOS DE UN ARTICULO DADO SEGUN SU ALMACEN
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerPrecios]
    @sCoArticulo	CHAR(30) ,
    @sCoAlmacen		CHAR(6),
	@scodigoUnidad	CHAR(6)
AS 
    BEGIN
		SELECT TP.co_precio, TP.des_precio, 
			[dbo].[PrecioAUnaFecha](@sCoArticulo,GETDATE(),TP.co_precio, @sCoAlmacen,NULL,0,NULL,@scodigoUnidad ) AS precio
			FROM [saTipoPrecio] TP
			WHERE [dbo].[PrecioAUnaFecha](@sCoArticulo,GETDATE(),TP.co_precio, @sCoAlmacen,NULL,0,NULL,@scodigoUnidad ) <> 0
			ORDER BY 2
    END
```
