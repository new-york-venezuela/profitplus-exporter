# SP: pInsertarImpCtaBcaria
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)

## Código (excerpt)
```sql
/******************************************************************
*CREADO			:	<2022-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pInsertarImpCtaBcaria 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  tasas
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [dbo].[pInsertarImpCtaBcaria]
    (
      @stipo_imp CHAR(3) ,
	  @scod_cta CHAR(6) ,
      @sdfecha_regis SMALLDATETIME ,
      @devalor_porcent DECIMAL(21, 8) ,
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
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        INSERT  INTO saImpuestoCuentaBancaria
                ( tipo_imp, fecha_regis, valor_porcent,cod_cta,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.rowguid, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @stipo_imp, @sdfecha_regis, @devalor_porcent,@scod_cta, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saImpuestoCuentaBancaria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @scod_cta			
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
