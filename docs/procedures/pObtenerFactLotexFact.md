# SP: pObtenerFactLotexFact
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)
- [`stgFacturaVentaExt`](../tables/stgFacturaVentaExt.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerFactLotexFact
*DESCRIPCIÓN	: Obtiene Facturas creadas por el por proceso FactLoteGen
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

Create PROCEDURE [dbo].[pObtenerFactLotexFact]
    (
      @sFactNum			CHAR (20) 	  

    )
AS 
    BEGIN	

		SELECT fl.*	from safacturaventa f 
		join stgfacturaventaext fex 
		on f.rowguid = fex.rowguid_doc_num 
		join stgfactlotegen fl 
		on fex.rowguid_num_FactLoteGen = fl.rowguid where f.doc_num = @sFactNum

	END
```
