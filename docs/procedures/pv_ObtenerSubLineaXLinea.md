# SP: pv_ObtenerSubLineaXLinea
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ObtenerSubLineaXLinea]
*DESCRIPCIÓN	:	OBTIENE TODAS LAS SUBLINEAS ASOCIADAS A UNA LINEA DADA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerSubLineaXLinea]
( 
	@sCo_Lin CHAR(6) 
)
AS 
    BEGIN
		SELECT co_subl, RTRIM(co_subl) + ' - ' + subl_des AS subl_des, SL.co_lin AS codigoLinea, LA.lin_des 
			FROM sasublinea SL 
				INNER JOIN saLineaArticulo LA ON SL.co_lin = LA.co_lin 
					WHERE SL.co_lin = @sCo_Lin
    END
```
