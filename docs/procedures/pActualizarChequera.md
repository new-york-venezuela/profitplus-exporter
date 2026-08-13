# SP: pActualizarChequera
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarChequera
*DESCRIPCIÓN	: Actualizar chequera
*AUTOR			: Softech Sistemas
************************************************************************/

CREATE PROCEDURE [pActualizarChequera]
    (
      @sCo_Chra CHAR(6) ,
      @sCo_ChraOri CHAR(6) ,
      @sChra_Des VARCHAR(60) ,
      @sCod_Cta CHAR(6) ,
      @sStatus CHAR(3) ,
      @iNum_Ch INT ,
      @sdFecha_Re SMALLDATETIME ,
      @sRespons CHAR(6) ,
      @bLimUsoRe BIT ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;

        UPDATE
            saChequera
        SET Co_Chra = @sCo_Chra, Chra_Des = @sChra_Des, cod_cta = @sCod_Cta, [Status] = @sStatus, Num_Ch = @iNum_Ch,
            Fecha_Re = @sdFecha_Re, Respons = @sRespons, LimUsoRe = @bLimUsoRe, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Chra = @sCo_ChraOri
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
                    @sTablaOri = 's
```
