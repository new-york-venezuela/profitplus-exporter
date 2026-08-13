# SP: pv_ObtenerSegmento
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerSegmento]
*DESCRIPCIÓN	:	OBTIENE LA LISTA DE SEGMENTOS DE LA TABLA 'saSegmento' PARA LA CREACION DE CLIENTE
					RAPIDO DESDE PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerSegmento]
AS
	BEGIN
		SELECT co_seg, seg_des FROM saSegmento 
	END
```
