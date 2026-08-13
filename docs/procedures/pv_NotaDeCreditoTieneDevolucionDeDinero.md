# SP: pv_NotaDeCreditoTieneDevolucionDeDinero
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvMovimientoCajaDevolucionExt`](../tables/pvMovimientoCajaDevolucionExt.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
CREATE  Procedure [dbo].[pv_NotaDeCreditoTieneDevolucionDeDinero] 
/******************************************************************************
* Stored Procedure	: Verifica si la nota de credito tiene relacionado una 
*						devolucion
* Fecha Creación	: 2013/05/27
* Creado por		: Softech Consultores
******************************************************************************/ 
@strNumNotaDeCredito char(20)
AS
BEGIN

	if exists(select DOC.rowguid from saDocumentoVenta DOC
				inner join [dbo].[pvMovimientoCajaDevolucionExt] MOVEXT on DOC.rowguid = MOVEXT.rowguid_nro_doc
				inner join [dbo].[saMovimientoCaja] MOVCAJ on MOVCAJ.rowguid = MOVEXT.rowguid_mov_num 
				where DOC.rowguid in (select rowguid_nro_doc from [dbo].[pvMovimientoCajaDevolucionExt])
					and DOC.anulado = 0 and DOC.co_tipo_doc = 'N/CR' and MOVCAJ.anulado = 0 and DOC.nro_doc = @strNumNotaDeCredito)
	Begin
		select 1;
		return
	End

	Select 0;	
	return;

END
```
