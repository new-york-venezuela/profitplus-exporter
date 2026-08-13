# SP: pActualizarConsecutivoTipo
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarBanco
*DESCRIPCIÓN	:	Actualiza un banco
*AUTOR			:	Softech Sistemas
***************************************************************************/

CREATE PROCEDURE [pActualizarConsecutivoTipo]
    (
      @sCo_Consecutivo CHAR(16) ,
      @sCo_ConsecutivoOri CHAR(16) ,
      @sDes_Consecutivo VARCHAR(60) ,
      @bUsoEmpresa BIT ,
      @bUsoSucursal BIT ,
      @sModulo CHAR(1) ,
      @sTabla CHAR(32) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN
	
        IF EXISTS ( SELECT
                        *
                    FROM
                        saConsecutivoTipo
                    WHERE
                        co_consecutivo = @sCo_ConsecutivoOri ) 
            BEGIN
                UPDATE
                    saConsecutivoTipo
                SET Co_Consecutivo = @sCo_Consecutivo, Des_Consecutivo = @sDes_Consecutivo, UsoEmpresa = @bUsoEmpresa,
                    UsoSucursal = @bUsoSucursal, Modulo = @sModulo, Tabla = @sTabla, co_us_mo = @sCo_Us_Mo,
                    co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
                WHERE
                    co_consecutivo = @sCo_ConsecutivoOri
            END
        ELSE 
            BEGIN
                INSERT  INTO saConsecutivoTipo
                        ( Co_Consecutivo, Des_Consecutivo, UsoEmpresa, UsoSucursal, Modulo, Tabla, co_us_in, co_us_mo,
                          co_sucu_in, co_sucu_mo, fe_us_in, fe_us_mo, revisado, trasnfe )
                VALUES
                        ( @sCo_Consecutivo, @sDes_Consecutivo, @bUsoEmpresa, @bUsoSucursal, @sModulo, @sTabla,
                          @sCo_Us_Mo, @sCo_Us_Mo, @sCo_Sucu_Mo, @sCo_Sucu_Mo, GETDATE(), GETDATE(), @sRevisado,
                          @sTrasnfe )
            END
    END
```
