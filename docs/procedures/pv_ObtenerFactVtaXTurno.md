# SP: pv_ObtenerFactVtaXTurno
**Tipo**: Punto de Venta
**Módulo**: Clientes

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCliente`](../tables/saCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
	*NOMBRE			: [pv_ObtenerFactVtaXTurno]
	*DESCRIPCIÓN	: SELECCIONA LAS FACTURAS EN ESPERA O NO PROCESADAS DE UN TURNO 
	*AUTOR			: SOFTECH SISTEMAS
	*MODIFICADO		: <2020-09-28>
	**************************************************************************/ 
	CREATE PROCEDURE [dbo].[pv_ObtenerFactVtaXTurno]
	(
			@sNum_Turno		CHAR(20),
			@sCo_Turno		CHAR(6) 
	)
	AS
	BEGIN
		   SELECT 
				  F.doc_num fact_num
				, F.co_cli
				, C.cli_des
				, C.rif
				, CASE Ext.estado WHEN 'E' THEN 'EN ESPERA' ELSE 
				
				CASE --Status para factura impresa pero no procesada
					WHEN F.impresa = 1
					AND ((F.impfis IS NULL OR LTRIM(RTRIM(F.impfis)) = '') 
					OR (F.impfisfac IS NULL OR LTRIM(RTRIM(F.impfisfac)) = '') 
					OR (F.imp_nro_z IS NULL OR LTRIM(RTRIM(F.imp_nro_z)) = ''))
				THEN 'DESCONOCIDO'
				ELSE 
				'NO PROCESADA'END  
				
				
				END Comentario 
				, F.fec_emis
		   FROM saFacturaVenta F
				INNER JOIN pvFacturaVentaExt Ext ON Ext.rowguid_doc_num = F.rowguid
				INNER JOIN pvTurnoExe T ON T.rowguid =  Ext.rowguid_num_turno
				INNER JOIN saCliente C ON C.co_cli = F.co_cli
		   WHERE  Ext.estado IN ('E', 'N') 
				AND F.anulado = 0 
				AND T.num_turno = @sNum_Turno AND T.co_turno = @sCo_Turno OPTION (FORCE ORDER)
	END
```
