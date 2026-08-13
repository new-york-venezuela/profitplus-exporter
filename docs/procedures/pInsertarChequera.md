# SP: pInsertarChequera
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarChequera
DESCRIPCION: Insertar Chequera
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarChequera]
    (
      @sCo_Chra CHAR(6) ,
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
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saChequera
                ( Co_Chra, Chra_Des, cod_cta, [Status], Num_Ch, Fecha_Re, Respons, LimUsoRe, campo1, campo2, campo3,
                  campo4, campo5, campo6, campo7, campo8, fe_us_in, co_us_in, co_sucu_in, fe_us_mo, co_us_mo, co_sucu_mo,
                  revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Chra, @sChra_Des, @sCod_Cta, @sStatus, @iNum_Ch, @sdFecha_Re, @sRespons, @bLimUsoRe, @sCampo1,
                  @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saChequera', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Chra

        SELECT
```
