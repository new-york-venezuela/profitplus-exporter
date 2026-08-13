# SP: pv_ObtenerAlmacen
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_Buscar_Sub_Alma]
*DESCRIPCIÓN	: BUSCA UNA LISTA ALMACENES QUE NO SEAN DE VENTA, ES DECIR; CON EL CAMPO NOVENTA = FALSE
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROC [dbo].[pv_ObtenerAlmacen]
AS
	BEGIN
		SELECT co_alma codigo,des_alma descripcion 
			FROM saAlmacen 
				WHERE noventa = 0
	END
```
