# SP: pv_ObtenerCodigoBarra
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvEtiquetaBalanza`](../tables/pvEtiquetaBalanza.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerCodigoBarra]
*DESCRIPCIÓN	: SELECCIONA TODOS LOS REGISTROS DE LA TABLA pvEtiquetaBalanza DONDE EL CAMPO ACTIVO = TRUE
*AUTOR			: SOFTECH SISTEMAS
*CREACIÓN		: 09/09/2013
*ACTUALIZACIÓN	: 16/09/2020
**************************************************************************/  
CREATE PROCEDURE [dbo].[pv_ObtenerCodigoBarra]
AS
	BEGIN
		SELECT co_etiqueta, pre,cod, suf, ent, dec, adic, peso_precio
			FROM pvEtiquetaBalanza
				WHERE activo = 1
	END
```
