# SP: pInsertarTasa
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/******************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pInsertarTasa 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  tasas
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [dbo].[pInsertarTasa]
    (
      @sCo_Mone CHAR(6) ,
      @sdFecha SMALLDATETIME ,
      @deTasa_C DECIMAL(21, 8) ,
      @deTasa_V DECIMAL(21, 8) ,
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
		
        INSERT  INTO saTasa
                ( co_mone, fecha, tasa_c, tasa_v, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Mone, @sdFecha, @deTasa_C, @deTasa_V, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sfecha_regis varchar(30)
		DECLARE @sCampos varchar(max)
		DECLARE @sAux2 varchar(30)

		SET @sfecha_regis = ' [Fecha:'+ rtrim(ltrim(CONVERT(varchar(20),@sdFecha,120))) + ']'
		SET @sCampos = rtrim(ltrim(@sCo_Mone)) + @sfecha_regis
		SET @sAux2 = '[c]' + CONVERT(varchar(50),@deTasa_C)+ ' [v]' +CONVERT(varchar(50),@deTasa_V)

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_
```
