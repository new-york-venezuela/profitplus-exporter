# SP: pv_ObtenerVendedorXCodigo
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************/
/*NOMBRE			: [pv_ObtenerVendedorXCodigo]*/
/*DESCRIPCIÓN	: OBTIENE UN VENDEDOR SEGUN SU CODIGO*/
/*AUTOR			: SOFTECH SISTEMAS*/
/**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerVendedorXCodigo]
(
	@sCo_ven		CHAR(6) ,
	@bFuncion	BIT
)
AS
BEGIN
	IF (@bFuncion = 1)
		SELECT co_ven AS Codigo, ven_des AS Descripcion
			  FROM saVendedor WHERE co_ven = @sCo_ven AND fun_ven = 1
	ELSE 
		SELECT co_ven AS Codigo, ven_des AS Descripcion
			  FROM saVendedor WHERE co_ven = @sCo_ven AND fun_cob = 1
END
```
