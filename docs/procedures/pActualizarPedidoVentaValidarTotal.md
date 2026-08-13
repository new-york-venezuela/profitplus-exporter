# SP: pActualizarPedidoVentaValidarTotal
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pActualizarPedidoVentaValidarTotal
*DESCRIPCIÓN	: valida los totales de un Pedido de venta vs la sumatoria de los renglones
*CREATE DATE    : 2024-10-21
*LASTUPDATE DATE: 2024-10-21
*AUTOR			: Softech
*************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarPedidoVentaValidarTotal]
    (
      @sDoc_Num CHAR(20) 	 , 
	  @sTipo_Doc CHAR(4) 
    )
AS 
BEGIN
	DECLARE @dTotal decimal(18,2) =0
	DECLARE @dTotal_bruto decimal(18,2)=0

	IF(@sTipo_Doc = 'PCLI' ) -- Pedidos Venta 
		BEGIN 

			SELECT @dTotal=sum(I.reng_neto), @dTotal_bruto=max(A.total_bruto) 
			FROM saPedidoVenta A join saPedidoVentaReng I on (A.doc_num = I.doc_num)
		    WHERE A.doc_num =@sDoc_Num
			GROUP BY A.doc_num
	
			IF ABS( @dTotal- @dTotal_bruto) >3
				 BEGIN  
					DECLARE @sMess varchar (250)= CONCAT('La sumatoria de los renglones ( ',@dTotal,' ) no coincide con el subtotal del documento ( ',@dTotal_bruto , ' ). Intente realizar nuevamente la operación.')
					RAISERROR( @sMess,16,1)                        
					ROLLBACK TRANSACTION 
				 END          

		 END
END
```
