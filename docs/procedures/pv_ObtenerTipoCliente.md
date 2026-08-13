# SP: pv_ObtenerTipoCliente
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerTipoCliente]
*DESCRIPCIÓN	:	OBTIENE UNA LISTA DE TIPO DE CLIENTE DE LA TABLA 'saTipoCliente' PARA CREAR
					CLIENTE RAPIDO DESDE PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerTipoCliente]
AS
	BEGIN
		SELECT tip_cli, des_tipo FROM saTipoCliente 
	END
```
