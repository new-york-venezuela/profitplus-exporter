# SP: pv_blanquearMovCajDev
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)

## Código (excerpt)
```sql
/******************************************************************************
* Stored Procedure : Blanquea el valor del movimiento de caja en la devolución*
* Fecha Creación   :  06/11/2013                                              *
*
******************************************************************************/
CREATE PROCEDURE [dbo].[pv_blanquearMovCajDev]
	(
		@iFactNum char(20),		
		@iMovCaj char(20)
	)
AS
BEGIN
	UPDATE saDevolucionCliente 
	set mov_num_c = NULL
	where mov_num_c = @iMovCaj
	and doc_num = @iFactNum
END
```
