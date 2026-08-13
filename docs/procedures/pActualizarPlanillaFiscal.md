# SP: pActualizarPlanillaFiscal
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saPlanillaFiscal`](../tables/saPlanillaFiscal.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarPlanillasFiscalesPagadas
*DESCRIPCIÓN	: Actualiza la tabla saPlanillasFiscales
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarPlanillaFiscal]
    (
      @sCod_Plan CHAR(6) ,
      @sCod_PlanOri CHAR(6) ,
      @sDes_Plan VARCHAR(60) ,
      @sTipo CHAR(1) ,
      @iAno INT ,
      @iMes INT ,
      @sdFecha_Pago SMALLDATETIME ,
      @sNumero_Plan VARCHAR(30) ,
      @dEMonto DECIMAL(18, 2) ,
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
            )

        UPDATE
            saPlanillaFiscal
        SET cod_plan = @sCod_Plan, des_plan = @sDes_Plan, tipo = @sTipo, ano = @iAno, mes = @iMes,
            fecha_pago = @sdFecha_Pago, numero_plan = @sNumero_Plan, monto = @deMonto, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_plan = @sCod_PlanOri
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
                EXEC [pInsertarPi
```
