# SP: pvTipoPrecioDesdeTipoCliente80
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvTipoPrecioDesdeTipoCliente80
*DESCRIPCIÓN	: Busca el precio segun el tipo de cliente ya sea el definido en la configuracion de usuario 
				  o en parametros (de punto de venta)
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE proc [dbo].[pvTipoPrecioDesdeTipoCliente80]
(
	@sTipcli CHAR(6) = NULL
)
AS

BEGIN
	SELECT tip_cli, saTipoPrecio.co_precio , saTipoPrecio.des_precio
		FROM saTipoCliente 
			INNER JOIN saTipoPrecio ON saTipoPrecio.co_precio = saTipoCliente.co_precio
		WHERE tip_cli=@sTipcli
	RETURN
END
```
