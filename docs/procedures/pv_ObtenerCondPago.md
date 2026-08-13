# SP: pv_ObtenerCondPago
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerCondPago]
*DESCRIPCIÓN	:	OBTIENE LA LISTA DE CONDICION DE PAGO DE LA TABLA 'saCondicionPago' PARA CREAR 
					CLIENTE RAPIDO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerCondPago]
AS
	BEGIN
		SELECT co_cond, cond_des FROM saCondicionPago 
	END
```
