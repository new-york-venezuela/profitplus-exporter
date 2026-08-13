# SP: pValidarDatosImportacionImpuestoAdicional
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16-05-2016>
-- Description:	<pValidarDatosImportancionImpuestoAdicional>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarDatosImportacionImpuestoAdicional]
	(
		@bCorregir BIT = 0, -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
		DECLARE @valPendienteResult TABLE ( motivo VARCHAR(256))		
		DECLARE @Motivo VARCHAR(256)
		DECLARE @PistaMensaje VARCHAR(MAX)		
		DECLARE @Id UNIQUEIDENTIFIER
		DECLARE @Monto_imp2 DECIMAL(15, 2)
		DECLARE @Monto_imp3 DECIMAL(15, 2)

		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				
			--4ta parte. El campo impuesto adicional de factura de compra, debe de reflejar la sumatoria de los campos impuestos adicional 2 e impuestos adicional 3.
			SELECT DISTINCT
				'La factura de compra nro. "' + RTRIM(FC.doc_num)  + '" posee en el campo impuesto adicional un valor de ' +
				RTRIM(CONVERT(DECIMAL(18, 2), ROUND(SUM(FC.monto_imp2),2)) + CONVERT(DECIMAL(18, 2), ROUND(SUM(FC.monto_imp3), 2))) +
				' y tiene que ser ' + 
				RTRIM(CONVERT(DECIMAL(18, 2),ROUND(SUM(FCR.monto_imp2), 2, 0)) + CONVERT(DECIMAL(18, 2),ROUND(SUM(FCR.monto_imp3), 2, 0)))
				AS motivo, FC.rowguid as Id,
				SUM(FCR.monto_imp2) AS Monto_imp2, SUM(FCR.monto_imp3) AS Monto_imp3
			FROM
				saFacturaCompra FC
				INNER JOIN saFacturaCompraReng FCR ON FC.doc_num = FCR.doc_num				
				RIGHT JOIN saDatosDeImportacion DI ON FCR.rowguid = DI.rowguid_factura_renglon
			GROUP BY
				FC.doc_num, FC.rowguid, FC.monto_imp2, FC.monto_imp3
			HAVING            		
				CONVERT(DECIMAL(18, 2), ROUND(SUM(FCR.monto_imp2),2)) <> ROUND(FC.monto_imp2,2) OR 
				CONVERT(DECIMAL(18, 2), ROUND(SUM(FCR.monto_imp3), 2)) <> ROUND(FC.monto_imp3, 2)

		OPEN PENDIENTE_VALIDAR		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id, @Monto_imp2, @Monto_imp3
		WHILE @@FETCH_STATUS = 0
		
			BEGIN				
				SET @PistaMensaje = @Motivo
				IF @bCorregir = 1
					BEGIN
						UPDATE saFacturaCompra
						SET monto_imp2 = @Monto_imp2, monto_imp3 = @Monto_imp3
						WHERE rowguid = @Id

						EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
						@sTablaOri = 'saFacturaCompra', @rowguidOri = @Id, @sTipo_Op = N'M', @sMaquina = NULL,
						@sCampos = @Pi
```
