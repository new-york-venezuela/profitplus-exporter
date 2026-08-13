# SP: pv_ObtenerLineaXArticulo
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerLineaXArticulo]
*DESCRIPCIÓN	:	OBTIENE LAS LINEAS QUE TIENE ASIGNADAS UN ARTICULO DADO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerLineaXArticulo]
(
	@sCo_Art CHAR(30) 
 )
AS 
    BEGIN
		SELECT co_lin01, co_lin02, co_lin03, co_lin04, co_lin05
			FROM saArtCaracteristica 
				WHERE co_art = @sCo_Art
    END
```
