# SP: pv_ObtenerZona
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerZona]
*DESCRIPCIÓN	:	OBTIENE UNA LISTA DE ZONAS DE LA TABLA 'saZona' AL CREAR CLIENTE RAPIDO DESDE 
					PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerZona]
AS
	BEGIN
		SELECT co_zon, zon_des FROM saZona 
	END
```
