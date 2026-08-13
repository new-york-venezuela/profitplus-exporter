# SP: pv_ObtenerCtaIngEgr
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerCtaIngEgr]
*DESCRIPCIÓN	:	OBTIENE UNA LISTA DE LOS REGISTROS DE LA TABLA 'saCuentaIngEgr' USADOS AL 
					MOMENTO DE CREAR CLIENTE RAPIDO DESDE PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerCtaIngEgr]
AS
	BEGIN
		SELECT co_cta_ingr_egr, descrip FROM saCuentaIngEgr 
	END
```
