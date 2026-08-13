# SP: pEliminarDocumentoImagen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			EliminarDocumentoImagen
-- DEXCRIPCIÓN:		Elimina la imgan de un documento
-- AUTOR:			SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pEliminarDocumentoImagen]
	(	  
	  @gRowguidDocOri UNIQUEIDENTIFIER,
	  @sCo_ImagOri CHAR(6),
	  @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
			DECLARE @TableTimestamp TABLE
				(
				  rowguid UNIQUEIDENTIFIER
				)
			DELETE FROM 
				saDocumentoImagen
			OUTPUT
				deleted.rowguid
				INTO @TableTimestamp
			 WHERE
				rowguidDoc = @gRowguidDocOri
				AND co_imag = @sCo_ImagOri
				AND validador = @tsValidador	
			
			DECLARE @dtFe_De DATETIME
			DECLARE @rowGuidOri UNIQUEIDENTIFIER

	        SELECT
		        @dtFe_De = GETDATE(), @rowGuidOri = rowguid
			FROM
				@TableTimestamp

			IF @dtFe_De IS NOT NULL 
				BEGIN
				-- Insertar Pista
					EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
						@sTablaOri = 'saDocumentoImagen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
						@sCampos = @sCo_ImagOri			
	            END
	END
```
