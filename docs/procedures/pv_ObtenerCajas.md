# SP: pv_ObtenerCajas
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
		*NOMBRE			:	pv_ObtenerCajas
		*DESCRIPCIÓN	:	OBTIENE LOS PRECIOS DE UN ARTICULO DADO SEGUN SU ALMACEN
		*AUTOR			:	SOFTECH SISTEMAS
		*********************************************************************/
		CREATE PROCEDURE [dbo].[pv_ObtenerCajas]
		AS 
			BEGIN
				  SELECT [cod_caja] ,[descrip], [descrip] AS caja  
				  FROM [dbo].[saCaja]
				  WHERE inactivo = 0
			END
```
