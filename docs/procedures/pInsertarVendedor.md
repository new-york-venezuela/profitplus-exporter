# SP: pInsertarVendedor
**Tipo**: Insertar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pInsertarVendedor
*DESCRIPCIÓN	: Insertar un Vendedor
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarVendedor]
    (
      @sCo_Ven CHAR(6) ,
      @sTipo CHAR(1) ,
      @sVen_Des VARCHAR(60) ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
      @sCedula CHAR(16) = NULL ,
      @sDirec1 VARCHAR(MAX) = NULL ,
      @sDirec2 VARCHAR(MAX) = NULL ,
      @sTelefonos VARCHAR(60) = NULL ,
      @sdFecha_Reg SMALLDATETIME ,
      @bInactivo BIT ,
      @deComision DECIMAL(18, 2) = NULL ,
      @sComentario VARCHAR(MAX) = NULL ,
      @bFun_Cob BIT ,
      @bFun_Ven BIT ,
      @deComisionV DECIMAL(18, 2) = NULL ,
      @sLogin VARCHAR(50) = NULL ,
      @sPassword VARCHAR(50) = NULL ,
      @sEmail VARCHAR(60) = NULL ,
      @sPSW_M VARCHAR(20) = NULL ,
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
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
      @sco_zon CHAR(6) = NULL
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

        INSERT  INTO saVendedor
                ( co_ven, tipo, ven_des, dis_cen, cedula, direc1, direc2, telefonos, fecha_reg, inactivo, comision,
                  comentario, fun_cob, fun_ven, comisionv, 
                    --fec_ult_ve, cli_ult_ve,  
                  login, password, email, PSW_M, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, co_zon )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Ven, @sTipo, @sVen_Des, @sDis_Cen, @sCedula, @sDirec1, @sDirec2, @sTelefonos, @sdFecha_Reg,
                  @bInactivo, @deComision, @sComentario, @b
```
