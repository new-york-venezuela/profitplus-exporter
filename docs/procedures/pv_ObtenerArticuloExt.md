# SP: pv_ObtenerArticuloExt
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerArticuloExt]
*DESCRIPCIÓN	:	OBTIENE EL COMENTARIO ADICIONAL DE UN ARTICULO DADO AL MOMENTO DE AGREGAR RENGLON DESDE PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerArticuloExt] 
( 
		@sCo_Art CHAR(30) 
)
AS 
    BEGIN
	 SELECT * FROM PvArticuloExt 
		WHERE id = (SELECT RowGuid FROM SaArticulo WHERE Co_art = @sCo_Art)
    END
```
