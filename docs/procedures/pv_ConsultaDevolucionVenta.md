# SP: pv_ConsultaDevolucionVenta
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ConsultaDevolucionVenta]
*DESCRIPCIÓN	: CONSULTA LAS DEVOLUCIONES PARA PROCESAR LA DEVOLUCION DE DINERO O REVERSAR LA DEVOLUCION DE DINERO,
				  COMPRENDIDAS ENTRE LAS FECHAS QUE LLEGAN POR PARAMETRO
				  QUE NO ESTEN ANULADAS Y EL NUMERO DEL MOVIMIENTO DEL DOCUMENTO NO SEA NULO
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pv_ConsultaDevolucionVenta]
(
	@dFechaDesde			SMALLDATETIME,
	@dFechaHasta			SMALLDATETIME,
	@sTipo_Operacion        CHAR(6)
)
AS
BEGIN

IF (@sTipo_Operacion = 'PRODEV')

	SELECT	
		dc.doc_num AS Devolucion, dc.fec_emis AS Fecha, 
		dc.co_cli AS Codigo, Cliente.cli_des AS Cliente, dc.anulado, 
		dc.total_neto AS Total, dv.saldo as Saldo, dc.mov_num_c as MovimientoCaja,

		CASE -- Retorna Numero Devolucion fiscal o numero control para formas libres
			WHEN dc.impfisfac IS NOT NULL AND dc.impfisfac <> '' THEN dc.impfisfac 
			ELSE dc.n_control 
		END AS numeroFiscal

	FROM  saDevolucionCliente dc
		
        INNER JOIN saDocumentoVenta dv ON dc.doc_num = dv.nro_orig AND dc.co_tipo_doc = dv.co_tipo_doc
		INNER JOIN saCliente Cliente ON Cliente.co_cli = dc.co_cli
		
	WHERE 
		dbo.FechaSimple(dc.fec_emis) >= @dFechaDesde AND 
		dbo.FechaSimple(dc.fec_emis) <= @dFechaHasta AND 
		dc.mov_num_c IS NULL AND 
		dv.saldo > 0 AND
		dv.anulado = 0 
		
	ORDER BY
		dc.fec_emis DESC

ELSE IF (@sTipo_Operacion = 'REVDEV')

	SELECT	
		dc.doc_num AS Devolucion, dc.fec_emis AS Fecha, 
		dc.co_cli AS Codigo, Cliente.cli_des AS Cliente, dc.anulado, 
		dc.total_neto AS Total, dv.saldo as Saldo, dc.mov_num_c as MovimientoCaja , 

		CASE -- Retorna Numero Devolucion fiscal o numero control para formas libres
			WHEN dc.impfisfac IS NOT NULL AND dc.impfisfac <> '' THEN dc.impfisfac 
			ELSE dc.n_control 
		END AS numeroFiscal

	FROM  saDevolucionCliente dc
		
        INNER JOIN saDocumentoVenta dv ON dc.doc_num = dv.nro_orig AND dc.co_tipo_doc = dv.co_tipo_doc
		INNER JOIN saCliente Cliente ON Cliente.co_cli = dc.co_cli
		
	WHERE 
		dbo.FechaSimple(dc.fec_emis) >= @dFechaDesde AND 
		dbo.FechaSimple(dc.fec_emis) <= @dFechaHasta AND 
		dc.mov_num_c IS NOT NULL AND
		dv.anulado = 0 
		
	ORDER BY
		dc.fec_emis DESC
END
```
