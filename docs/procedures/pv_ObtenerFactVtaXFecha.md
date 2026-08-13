# SP: pv_ObtenerFactVtaXFecha
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
		*NOMBRE			: [pv_ObtenerFactVtaXFecha]
		*DESCRIPCIÓN	: CONSULTA LAS FACTURAS DE VENTA DONDE EL TOTAL DEVUELTO POR RENGLON NO SEA MAYOR AL TOTAL
						  DE ARTICULOS POR RENGLON	
		*AUTOR			: SOFTECH SISTEMAS
		**************************************************************************/
		CREATE PROCEDURE [dbo].[pv_ObtenerFactVtaXFecha]
		(
			@dFechaDesde	SMALLDATETIME,
			@dFechaHasta	SMALLDATETIME
		)
		AS
		BEGIN
			   SET @dFechaDesde = dbo.FechaSimple(@dFechaDesde)

			   SELECT TOP 10000 F.doc_num AS Factura, F.fec_emis AS Fecha, 
								   F.co_cli AS Codigo, F.anulado, 
								   C.cli_des AS Cliente, F.total_neto AS Total,
		CASE -- Retorna Numero factura fiscal o numero control para formas libres
			WHEN impfisfac IS NOT NULL AND impfisfac <> '' THEN impfisfac 
			ELSE n_control 
		END AS numeroFiscal

			   FROM saFacturaVenta F 
							INNER JOIN saCliente C ON F.co_cli = C.co_cli
							INNER JOIN pvFacturaVentaExt FactExt ON FactExt.rowguid_doc_num = F.rowguid
								   WHERE 
										  F.fec_emis >= @dFechaDesde AND 
										  dbo.FechaSimple(F.fec_emis) <= @dFechaHasta AND 
										  EXISTS (SELECT * FROM saFacturaVentaReng FacturaReng WHERE FacturaReng.doc_num = F.doc_num
													   AND FacturaReng.total_dev < FacturaReng.total_art)
										  AND 
										  F.anulado = 0 
										  AND 
										  FactExt.estado = 'P'
		END
```
