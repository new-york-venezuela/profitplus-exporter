# SP: pValidarDatosImportacionImpuesto
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <11-05-2016>
-- Description:	<pValidarDatosImportancionImpuesto>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarDatosImportacionImpuesto]
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
		DECLARE @Monto DECIMAL(18,2)
		DECLARE @HoraCorrida DATETIME
				
		SET @HoraCorrida = GETDATE()

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAst_FORWARD
		FOR				
			--1era parte. El impuesto adicional del documento de compra debe de coincidir con el de la factura de compra.
			SELECT DISTINCT
				'El documento de compra nro. ' + RTRIM(DC.nro_doc)  + ' posee un impuesto adicional de "' + RTRIM(DC.monto_imp2) +
				'" y tiene que ser ' + RTRIM(FC.monto_imp2) AS motivo, DC.rowguid AS Id, FC.monto_imp2 AS Monto
			FROM
				saFacturaCompra  FC
				INNER JOIN saDocumentoCompra DC ON FC.doc_num = DC.nro_doc AND DC.co_tipo_doc = 'FACT'							
			WHERE            		
				DC.rowguid IS NOT NULL AND DC.monto_imp2 <> FC.monto_imp2

		OPEN PENDIENTE_VALIDAR		

		FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id, @Monto
		WHILE @@FETCH_STATUS = 0
		
			BEGIN				
				SET @PistaMensaje = @Motivo
				IF @bCorregir = 1
					BEGIN
						UPDATE saDocumentoCompra
						SET monto_imp2 = @Monto
						WHERE rowguid = @Id

						EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
						@sTablaOri = 'saDocumentoCompra', @rowguidOri = @Id, @sTipo_Op = N'M', @sMaquina = NULL,
						@sCampos = @PistaMensaje
					END				
					
				EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                @sTablaOri = 'saDocumentoCompra', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = NULL,
                @sCampos = @PistaMensaje										
					
				INSERT INTO @valPendienteResult (motivo)
				VALUES (@PistaMensaje)
				FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Motivo, @Id, @Monto
			END

			CLOSE PENDIENTE_VALIDAR
			DEALLOCATE PENDIENTE_VALIDAR

			SELECT 
				*
			FROM
				@valPendienteResult
	END
```
