# SP: pActualizarTasa
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/******************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pActualizarTasa 
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  tasas
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pActualizarTasa]
    (
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sCo_Mone CHAR(6) ,
      @SCo_MoneOri CHAR(6) ,
      @sdFecha SMALLDATETIME ,
      @sdFechaOri SMALLDATETIME ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
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
		
        UPDATE
            saTasa
        SET co_mone = @sCo_Mone, fecha = @sdFecha, tasa_c = @deTasa_C, tasa_v = @deTasa_V, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_mone = @SCo_MoneOri
            AND fecha = @sdFechaOri
			
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
                    @sTablaOri = 'saTasa', @rowguidOri = @rowGu
```
