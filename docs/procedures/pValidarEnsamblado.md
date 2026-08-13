# SP: pValidarEnsamblado
**Tipo**: Validar
**Módulo**: General

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18-04-2016>
-- Description:	<pValidarEnsamblado>
-- =============================================
CREATE PROCEDURE [dbo].[pValidarEnsamblado]
	(
		@bCorregir BIT = 0, --INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
		@IdProcess UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN

		DECLARE @valPendienteResult TABLE ( Motivo VARCHAR(256) )
		DECLARE @pValue_Use SQL_VARIANT
		DECLARE @pConfiguration_ID INT
		DECLARE @pName NVARCHAR(50)
		DECLARE @PistaMensaje VARCHAR(MAX)
		DECLARE @HoraCorrida DATETIME

		DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
				FOR
					
					SELECT

						value_in_use, configuration_id, name 
					
					FROM

						sys.configurations

					WHERE

						configuration_id IN (518, 1562)
						AND
						value_in_use <> 1

					ORDER BY configuration_id

			OPEN PENDIENTE_VALIDAR
			FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pValue_Use, @pConfiguration_ID, @pName

			WHILE @@FETCH_STATUS = 0 
			BEGIN
				   SET @PistaMensaje = 'La configuración "' + CONVERT(VARCHAR, @pConfiguration_ID) + ' - ' + @pName + '" tiene un valor de "' + CONVERT(VARCHAR, @pValue_Use) + '" y debería ser de "1".' 

				   IF ( @bCorregir = 1) 
				   BEGIN  

						IF @pConfiguration_ID = 518
						BEGIN
							EXEC SP_CONFIGURE 'show advanced options', 1;
							RECONFIGURE;
						END

						IF @pConfiguration_ID = 1562
						BEGIN
							EXEC SP_CONFIGURE 'clr enabled', 1;
							RECONFIGURE;
						END

						SET @HoraCorrida = GETDATE()
						EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
						@sTablaOri = 'sys.configurations', @rowguidOri = NULL, @sTipo_Op = N'M', @sMaquina = NULL,
						@sCampos = @PistaMensaje
								
				   END

					   SET @HoraCorrida = GETDATE()
						EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
						@sTablaOri = 'sys.configurations', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = NULL,
						@sCampos = @PistaMensaje

				   INSERT INTO @valPendienteResult (Motivo)
					VALUES (@PistaMensaje)
					FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pValue_Use, @pConfiguration_ID, @pName
			END

			CLOSE PENDIENTE_VALIDAR
			DEALLOCATE PENDIENTE_VALIDAR

			SELECT 
				*
			FROM
				@valPendienteResult 
				
	END
```
