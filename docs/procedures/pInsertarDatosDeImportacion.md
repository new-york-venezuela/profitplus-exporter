# SP: pInsertarDatosDeImportacion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)

## Código (excerpt)
```sql
/************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pInsertarDatosDeImportacion
*DESCRIPCIÓN	: Inserta datos de importacion a un renglon de la factura de compra
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarDatosDeImportacion]
    (
      @gRowguid_Factura_Renglon UNIQUEIDENTIFIER ,
      @sFact_Num VARCHAR(20) ,
      @sBl_Awb_Cpi VARCHAR(60) = NULL,
	  @iTasa int = NULL,
	  @deTasaValor DECIMAL(21, 8) = NULL,
	  @deTotal DECIMAL(18, 5) = NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

			INSERT  INTO saDatosDeImportacion
					( rowguid_factura_renglon, fact_num, bl_awb_cpi, tasa, total_imp, tasa_valor,
					campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
						co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
			OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			VALUES
					( @gRowguid_Factura_Renglon, @sFact_Num, @sBl_Awb_Cpi, @iTasa, @deTotal, @deTasaValor,
					@sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
						@sCampo7, @sCampo8, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In,
						@sCo_Sucu_In )


			DECLARE @dtFe_In DATETIME
			DECLARE @rowGuidOri UNIQUEIDENTIFIER

			SELECT
				@dtFe_In = fe_us_in, @rowGuidOri = rowguid
			FROM
				@TableTimestamp

			-- Insertar Pista
			EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
				@sTablaOri = 'saDatosDeImportacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
				@sCampos = @gRowguid_Factura_Renglon
		
			SELECT
				*
			FROM
				@TableTimestamp
		END
```
