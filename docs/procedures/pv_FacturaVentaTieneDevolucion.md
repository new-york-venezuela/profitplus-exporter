# SP: pv_FacturaVentaTieneDevolucion
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
CREATE  PROCEDURE [dbo].[pv_FacturaVentaTieneDevolucion] 
/******************************************************************************
* Stored Procedure	: Verifica si la factura tiene una devolucion asociada 
* Fecha Creación	: 2013/05/27
* Creado por		: Softech Consultores
******************************************************************************/ 
@strNumFacturaVenta char(20)
AS
BEGIN

	if exists(select FVR.doc_num from saFacturaVentaReng FVR
				inner join saFacturaVenta FV on FVR.doc_num = FV.doc_num
				where FV.anulado = 0 and FVR.rowguid in (select rowguid_doc from saDevolucionClienteReng where tipo_doc = 'FACT')
				and FVR.doc_num = @strNumFacturaVenta
				)
	Begin
		select 1;
		return
	End

	Select 0;	
	return;

END
```
