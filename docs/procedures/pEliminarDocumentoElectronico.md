# SP: pEliminarDocumentoElectronico
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pEliminarDocumentoElectronico
-- DEXCRIPCIÓN:		Elimina el documento electrónico
-- AUTOR:			SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pEliminarDocumentoElectronico]
	( 
	  @sCo_doc_elecOri CHAR(20),
	  @sTipo_documentoOri CHAR(10),
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
				saDocumentoElectronico
			OUTPUT
				deleted.rowguid
				INTO @TableTimestamp
			 WHERE
				co_doc_elec = @sCo_doc_elecOri AND
				tipo_documento = @sTipo_documentoOri AND
				validador = @tsValidador	
			
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
						@sTablaOri = 'saDocumentoElectronico', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
						@sCampos = @sCo_doc_elecOri			
	            END
	END
```
