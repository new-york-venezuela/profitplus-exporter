# SP: pActualizarRenglonConsecutivoSucursal
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarRenglonConsecutivoSucursal]
    (
      @sCodigoOri CHAR(20) ,
      @sCodigo CHAR(20) ,
      @bEsParEmp BIT ,
      @bEsParEmpOri BIT ,
      @sCo_Consecutivo CHAR(16) ,
      @sCo_ConsecutivoOri CHAR(16) ,
      @sDes_Consecutivo VARCHAR(60) ,
      @sCo_Serie CHAR(20) ,
      @iTipo INT ,
      @iProx_N BIGINT ,
      @sProx_A CHAR(20) = NULL ,
      @sModulo CHAR(1) ,
      @iRENG_NUMOri INT ,
      @iReng_Num INT ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        IF ( @bEsParEmp = 0 ) 
            BEGIN    

                UPDATE
                    saConsecutivo
                SET co_sucur = @sCodigo, co_consecutivo = @sCo_Consecutivo, co_serie = @sCo_Serie, co_us_mo = @sCo_Us_Mo,
                    fe_us_mo = GETDATE(), revisado = @sRevisado, co_sucu_mo = @sCo_Sucu_Mo, trasnfe = @sTrasnfe
                OUTPUT
                    inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    co_sucur = @sCodigoOri
                    AND co_consecutivo = @sCo_ConsecutivoOri
            END

        ELSE 
            BEGIN
                UPDATE
                    saConsecutivo
                SET co_emp = @sCodigo, co_consecutivo = @sCo_Consecutivo, co_serie = @sCo_Serie, co_us_mo = @sCo_Us_Mo,
                    fe_us_mo = GETDATE(), revisado = @sRevisado, co_sucu_mo = @sCo_Sucu_Mo, trasnfe = @sTrasnfe
                OUTPUT
                    inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                    INTO @TableTimestamp
                WHERE
                    co_emp = @sCodigoOri
                    AND co_consecutivo = @sCo_ConsecutivoOri

            END 
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @
```
