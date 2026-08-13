# SP: pActualizarDocumentoImagen
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pActualizarDocumentoImagen
-- DESCRIPCIÓN:		Actualiza la imagen de un documento
-- AUTOR:			SOFTECH SISTEMAS
-- =============================================

CREATE PROCEDURE [dbo].[pActualizarDocumentoImagen]
	(	  
	  @sCo_Tipo_Doc CHAR(6),	  
	  @gRowguidDoc UNIQUEIDENTIFIER,
	  @gRowguidDocOri UNIQUEIDENTIFIER,
	  @sCo_Imag CHAR(6),
	  @sCo_ImagOri CHAR(6),
	  @sDes_Imag VARCHAR(MAX),
	  @sCo_Tipo_Imag CHAR(6) = NULL,
	  @baPicture VARBINARY(MAX) = NULL,
	  @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6),
      @sCo_sucu_Mo CHAR(6),
      @sMaquina VARCHAR(60) = NULL ,
	  @sCampos VARCHAR(MAX) = NULL,
      @srevisado CHAR(1),
      @strasnfe CHAR(1),
	  @tsValidador TIMESTAMP,
      @gRowguid UNIQUEIDENTIFIER = NULL
	)
AS
	BEGIN
	
		DECLARE @TableTimestamp TABLE
		(
		  validador VARBINARY(MAX),
		  fe_us_in DATETIME,
		  fe_us_mo DATETIME,
		  rowguid UNIQUEIDENTIFIER
		)

		UPDATE
			saDocumentoImagen
		SET co_tipo_doc = @sCo_Tipo_Doc, rowguidDoc = @gRowguidDoc, co_imag = @sCo_Imag, des_imag = @sDes_Imag,
			co_tipo_imag = @sCo_Tipo_Imag, picture = @baPicture, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, 
			campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, 
			co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @srevisado, trasnfe = @strasnfe
		OUTPUT
				inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				INTO @TableTimestamp
		   WHERE				
				rowguidDoc = @gRowguidDocOri
				AND co_imag = @sCo_ImagOri
				AND validador = @tsValidador

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		 IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDocumentoImagen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCa
```
