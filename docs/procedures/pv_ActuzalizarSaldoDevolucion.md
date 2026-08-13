# SP: pv_ActuzalizarSaldoDevolucion
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
CREATE PROCEDURE [dbo].[pv_ActuzalizarSaldoDevolucion]
	(
		@iFactNum char(20),		
		@iMovCaj char(20),
		@deSaldo decimal(18,2)
	)
AS
BEGIN
	UPDATE saDevolucionCliente 
	set saldo = saldo - @deSaldo
	where mov_num_c = @iMovCaj
	and doc_num = @iFactNum
END
```
