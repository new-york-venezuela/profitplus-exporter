# SP: pObtenerFactLoteGenVentaExt
**Tipo**: Obtener
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)
- [`stgFacturaVentaExt`](../tables/stgFacturaVentaExt.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerFactLoteGenVentaExt
*DESCRIPCIÓN	: Obtiene Facturas creadas por el proceso FactLoteGen
*FECHA CREACIÓN : <2019-07-17>
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerFactLoteGenVentaExt]
    (
      @sco_fact_lote_gen char(6)  	  

    )
AS 
    BEGIN	

		SELECT f.doc_num, f.co_cli, status, f.impresa, f.anulado, f.n_control, f.fec_emis, f.fec_venc, f.saldo, f.total_neto, f.total_bruto, 
		       f.monto_imp, f.co_cli, f.co_ven,f.co_mone, f.co_us_in, f.co_sucu_in, f.anulado, f.co_cond
		from safacturaventa f join stgfacturaventaext fex on f.rowguid = fex.rowguid_doc_num 
		                      join stgfactlotegen fl on fex.rowguid_num_FactLoteGen = fl.rowguid 
	    where fl.co_fact_lote_gen =  @sco_fact_lote_gen AND f.anulado = 0
		ORDER BY f.doc_num

    END
```
