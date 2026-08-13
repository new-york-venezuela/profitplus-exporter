# SP: pActualizarCuentaBancaria
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pActualizarCuentaBancaria   
*DESCRIPCIÓN	: Actualizar Cuenta Bancaria
*AUTOR			: Softech Sistemas
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarCuentaBancaria]
    (
      @sCod_Cta CHAR(6) ,
      @sCod_CtaOri CHAR(6) ,
      @sCo_Ban CHAR(6) ,
      @sNum_Cta VARCHAR(50) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sSucursal VARCHAR(60) ,
      @sTelefonos VARCHAR(60) ,
      @sdMes_Ini SMALLDATETIME ,
      @sCo_Mone CHAR(6) ,
      @bInactivo BIT ,
      @bUsa_Chra BIT ,
      @sEjec_Cu VARCHAR(30) ,
      @sDireccion VARCHAR(120) ,
      @sEmail VARCHAR(40) ,
      @sTipo_Cu VARCHAR(30) ,
      @sdFecini SMALLDATETIME ,
      @sdFec_Chra SMALLDATETIME ,
	  @desaldo_ti decimal(18, 2),
	  @desaldo_ci decimal(18, 2),
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
      @sMaquina VARCHAR(60) = NULL,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP = NULL ,
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
            saCuentaBancaria
        SET cod_cta = @sCod_Cta, co_ban = @sCo_Ban, num_cta = @sNum_Cta, dis_cen = @sDis_Cen, sucursal = @sSucursal,
            telefonos = @sTelefonos, mes_ini = @sdMes_Ini, co_mone = @sCo_Mone, inactivo = @bInactivo,
            usa_chra = @bUsa_Chra, ejec_cu = @sEjec_Cu, direccion = @sDireccion, email = @sEmail, tipo_cu = @sTipo_Cu,
            fecini = @sdFecini, fec_chra = @sdFec_Chra, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3,
            campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_Us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo,
```
