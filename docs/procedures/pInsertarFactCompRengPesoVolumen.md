# SP: pInsertarFactCompRengPesoVolumen
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pInsertarFactCompRengPesoVolumen
-- DESCRIPCIÓN: Inserta el peso y volumen del renglón de la factura de compra
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarFactCompRengPesoVolumen]
	(	  
	  @gRowguidDoc UNIQUEIDENTIFIER,
	  @dePeso_Comp DECIMAL (18, 2),
	  @deVolumen_Comp DECIMAL (18, 2),	  
      @sCo_Us_In CHAR(6) ,
      @sCo_sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @srevisado CHAR(1) = NULL,
      @strasnfe CHAR(1) = NULL
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

	INSERT INTO saFactCompRengPesoVolumen
			(rowguidDoc, peso_comp, volumen_comp, co_us_in, co_sucu_in, fe_us_in, revisado, trasnfe, co_us_mo, co_sucu_mo, fe_us_mo)
	OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, inserted.rowguidDoc
			INTO @TableTimestamp
	VALUES
			(@gRowguidDoc, @dePeso_Comp, @deVolumen_Comp, @sCo_Us_In, @sCo_sucu_In, GETDATE(), @srevisado, 
			@strasnfe, @sCo_Us_In, @sCo_sucu_In, GETDATE())

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidDocOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidDocOri = rowguidDoc
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saFactCompRengPesoVolumen', @rowguidOri = @rowGuidDocOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @gRowguidDoc			
					
        SELECT
            *
        FROM
            @TableTimestamp


	END
```
