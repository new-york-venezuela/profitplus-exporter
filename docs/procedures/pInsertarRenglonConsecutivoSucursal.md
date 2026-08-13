# SP: pInsertarRenglonConsecutivoSucursal
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pInsertarRenglonConsecutivoSucursal]
    (
      @sCodigo CHAR(20) ,
      @bEsParEmp BIT ,
      @sCo_Consecutivo CHAR(16) ,
      @sDes_Consecutivo VARCHAR(60) ,
      @sCo_Serie CHAR(20) ,
      @iTipo INT ,
      @iProx_N BIGINT ,
      @sProx_A CHAR(20) ,
      @sModulo CHAR(1) ,
      @iReng_Num INT ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Us_In CHAR(6)
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
    
        IF ( @bEsParEmp = 0 ) 
            BEGIN
                INSERT  INTO saConsecutivo
                        ( co_sucur, co_consecutivo, co_serie, co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe,
                          co_sucu_in, co_sucu_mo )
                OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                        INTO @TableTimestamp
                VALUES
                        ( @sCodigo, @sCo_Consecutivo, @sCo_Serie, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(),
                          @sRevisado, @sTrasnfe, @sCo_Sucu_In, @sCo_Sucu_In )
            END
        ELSE 
            BEGIN
                INSERT  INTO saConsecutivo
                        ( co_emp, co_consecutivo, co_serie, co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe,
                          co_sucu_in, co_sucu_mo )
                OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                        INTO @TableTimestamp
                VALUES
                        ( @sCodigo, @sCo_Consecutivo, @sCo_Serie, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(),
                          @sRevisado, @sTrasnfe, @sCo_Sucu_In, @sCo_Sucu_In )
            END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
