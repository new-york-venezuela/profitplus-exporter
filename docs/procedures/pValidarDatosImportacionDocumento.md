# SP: pValidarDatosImportacionDocumento
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <11-05-2016>
-- LastUpdate:  <2020-08-03>
-- Description:	<pValidarDatosImportacionDocumento>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarDatosImportacionDocumento]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @PistaMensaje VARCHAR(MAX)		
		DECLARE @Nro_doc CHAR(20)
		DECLARE @Co_prov CHAR(16)
		DECLARE @Co_mone CHAR(6)
		DECLARE @Fec_reg SMALLDATETIME
		DECLARE @Fec_emis SMALLDATETIME
		DECLARE @Anulado BIT
		DECLARE @Nro_fact VARCHAR(20)
		DECLARE @Observa VARCHAR(MAX)
		DECLARE @Tasa DECIMAL(21,8)
		DECLARE @Monto_imp DECIMAL(18,2)
		DECLARE @Monto_imp2 DECIMAL(18,2)
		DECLARE @Monto_imp3 DECIMAL(18,2)
		DECLARE @Total_bruto DECIMAL(18,2)
		DECLARE @Porc_desc_glob VARCHAR(15)
		DECLARE @Monto_desc_glob DECIMAL(18,2)
		DECLARE @Porc_reca VARCHAR(15)
		DECLARE @Monto_reca DECIMAL(18,2)
		DECLARE @Total_neto DECIMAL(18,2)
		DECLARE @Saldo DECIMAL(18,2)		
		DECLARE @N_control VARCHAR(20)
		DECLARE @Fec_venc SMALLDATETIME
		DECLARE @Nac BIT

		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				
			--2da parte. Existe la factura de compra pero no el documento de compra.
			SELECT DISTINCT
				'La factura de compra nro. ' + RTRIM(FC.doc_num)  + ' no posee documento de compra asociado.' AS motivo, FC.doc_num,
				FC.co_prov, FC.co_mone, FC.fec_reg, FC.fec_emis, FC.anulado, FC.nro_fact, 'FACT N° ' + RTRIM(FC.nro_fact) + 
				' de proveedor ' + RTRIM(FC.co_prov) AS Observa, FC.tasa, FC.monto_imp, FC.monto_imp2,
				FC.monto_imp3, FC.total_bruto, FC.porc_desc_glob, FC.monto_desc_glob, FC.porc_reca, FC.monto_reca, FC.total_neto, 
				FC.saldo, FC.n_control, FC.fec_venc, FC.nac	
			FROM
				saFacturaCompra FC
				INNER JOIN saFacturaCompraReng FCR ON FC.doc_num = FCR.doc_num
				RIGHT JOIN saDatosDeImportacion DI ON FCR.rowguid = DI.rowguid_factura_renglon
				LEFT JOIN saDocumentoCompra DC ON FC.doc_num = DC.nro_doc AND DC.co_tipo_doc = 'FACT'							
			WHERE            		
				DC.rowguid IS NULL

		OPEN PENDIENTE_VALIDAR		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Nro_doc, @Co_prov, @Co_mone, @Fec_reg, @Fec_emis,
```
