# SP: pInsertarCuentaBancaria
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarCuentaBancaria   
DESCRIPCION: Insertar Cuenta Bancaria
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarCuentaBancaria]
    (
      @sCod_Cta CHAR(6) ,
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
      @sDireccion VARCHAR(MAX) ,
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
            ) ;
	
        INSERT  INTO saCuentaBancaria
                ( cod_cta, co_ban, num_cta, dis_cen, sucursal, telefonos, mes_ini, co_mone, inactivo, usa_chra, ejec_cu,
                  direccion, email, tipo_cu, fecini, fec_chra, campo1, campo2, campo3, campo4, campo5, campo6, campo7,
                  campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Cta, @sCo_Ban, @sNum_Cta, @sDis_Cen, @sSucursal, @sTelefonos, @sdMes_Ini, @sCo_Mone, @bInactivo,
                  @bUsa_Chra, @sEjec_Cu, @sDireccion, @sEmail, @sTipo_Cu, @sdFecini, @sdFec_Chra, @sCampo1, @sCampo2,
                  @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo
```
