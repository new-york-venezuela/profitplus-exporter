# SP: pv_ObtenerDocVtaNCR
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`pvMovimientoCajaDevolucionExt`](../tables/pvMovimientoCajaDevolucionExt.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ObtenerDocVtaNCR]
*DESCRIPCIÓN	: BUSCA LOS DOCUMENTOS DE VENTA QUE NO ESTEN ANULADOS, ESTEN COMPRENDIDOS ENTRE LAS FECHAS QUE
				  LLEGAN COMO PARAMETRO Y EL TIPO DE DOCUMENTO SEA N/CR
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerDocVtaNCR]
(
	@dFechaDesde			SMALLDATETIME,
	@dFechaHasta			SMALLDATETIME,
	@sTipo_Operacion        CHAR(6),
	@sTipo_Documento        CHAR(6)
)
AS
BEGIN
	IF (@sTipo_Operacion = 'PRODEV')

		SELECT	
			DV.nro_doc AS NumeroDocumento, dv.co_tipo_doc AS TipoDocumento,
			DV.doc_orig AS TipoOrigen, dv.nro_orig AS DocumentoOrigen, 
			DV.fec_emis AS Fecha, dv.co_cli AS Codigo, Cliente.cli_des AS Cliente,
			DV.anulado, DV.total_neto AS Total, DV.saldo as Saldo, 
			
			CASE -- Retorna Numero Devolucion fiscal o numero control para formas libres
			WHEN DV.impfisfac IS NOT NULL AND DV.impfisfac <> '' THEN DV.impfisfac 
			ELSE DV.n_control 
		END AS numeroFiscal

		FROM  saDocumentoVenta DV
		   INNER JOIN saCliente Cliente ON Cliente.co_cli = DV.co_cli
		
		WHERE 
			DV.rowguid NOT IN 
				(SELECT mcd.rowguid_nro_doc FROM 
					pvMovimientoCajaDevolucionExt mcd
					INNER JOIN saMovimientoCaja MOVCAJ ON MOVCAJ.rowguid = mcd.rowguid_mov_num 
					where 
					MOVCAJ.anulado = 0
				) AND
			dbo.FechaSimple(DV.fec_emis) >= @dFechaDesde AND 
			dbo.FechaSimple(DV.fec_emis) <= @dFechaHasta AND 
			DV.co_tipo_doc = @sTipo_Documento AND 
			DV.saldo > 0 AND
			DV.anulado = 0 
		ORDER BY
			DV.fec_emis DESC

	ELSE IF (@sTipo_Operacion = 'REVDEV')
			SELECT	
			DV.nro_doc AS NumeroDocumento, DV.co_tipo_doc AS TipoDocumento,
			DV.doc_orig AS TipoOrigen, DV.nro_orig AS DocumentoOrigen, 
			DV.fec_emis AS Fecha, DV.co_cli AS Codigo, Cliente.cli_des AS Cliente,
			DV.anulado, DV.total_neto AS Total, DV.saldo AS Saldo , 
				CASE -- Retorna Numero Devolucion fiscal o numero control para formas libres
			WHEN DV.impfisfac IS NOT NULL AND DV.impfisfac <> '' THEN DV.impfisfac 
			ELSE DV.n_control 
		END AS numeroFiscal
		FROM  saDocumentoVenta dv
			INNER JOIN pvMovimientoCajaDevolucionExt mcd ON dv.rowguid = mcd.rowguid_nro_doc
			INNER JOIN saMovimientoCaja MOVCAJ on MOVCAJ.rowguid = mcd.rowguid_mov_num 
			INNER JOIN saCliente Cliente ON Cliente.co_cli = dv.co_cli
		WHERE 
			dbo.FechaSimple(dv.fec_emis)
```
