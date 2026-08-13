# SP: pActualizarFactCompRengPesoVolumen
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:			pActualizarFactCompRengPesoVolumen
-- DESCRIPCIÓN:		Actualiza el peso y volumen del renglón de la factura de compra
-- AUTOR:			SOFTECH SISTEMAS
-- =============================================

CREATE PROCEDURE [dbo].[pActualizarFactCompRengPesoVolumen]
	( 
	  @gRowguidDoc UNIQUEIDENTIFIER,	  
	  @dePeso_Comp DECIMAL (18, 2),
	  @deVolumen_Comp DECIMAL (18, 2),	  
      @sCo_Us_Mo CHAR(6),
      @sCo_sucu_Mo CHAR(6),
      @sMaquina VARCHAR(60) = NULL ,
	  @sCampos VARCHAR(MAX) = NULL,
      @srevisado CHAR(1) = NULL,
      @strasnfe CHAR(1) = NULL,
	  @tsValidador TIMESTAMP      
	)
AS
	BEGIN
	
		DECLARE @TableTimestamp TABLE
		(
		  validador VARBINARY(MAX),
		  fe_us_in DATETIME,
		  fe_us_mo DATETIME,
		  rowguidDoc UNIQUEIDENTIFIER
		)

		UPDATE
			saFactCompRengPesoVolumen
		SET peso_comp = @dePeso_Comp, volumen_comp = @deVolumen_Comp, co_us_mo = @sCo_Us_Mo, 
			co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @srevisado, trasnfe = @strasnfe
		OUTPUT
			inserted.validador, inserted.fe_us_in, inserted.fe_us_mo,Inserted.rowguidDoc
			INTO @TableTimestamp
		   WHERE				
				rowguidDoc = @gRowguidDoc
				AND validador = @tsValidador

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguidDoc
        FROM
            @TableTimestamp

		 IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFactCompRengPesoVolumen', @rowguidOri = @gRowguidDoc, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos			
            END

        SELECT
            *
        FROM
            @TableTimestamp


	END
```
