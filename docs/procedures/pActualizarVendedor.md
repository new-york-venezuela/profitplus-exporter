# SP: pActualizarVendedor
**Tipo**: Actualizar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarVendedor
*DESCRIPCIÓN	: Actualiza un Vendedor
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarVendedor]
    (
      @sCo_Ven CHAR(6) ,
      @sCo_VenOri CHAR(6) ,
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
--     @iFac_Ult_Ve INT                        =      NULL,
--     @sdFec_Ult_Ve SMALLDATETIME =      NULL,
--     @deNet_Ult_Ve DECIMAL      (18,2) =      NULL,
--     @sCli_Ult_Ve CHAR   (6)          =      NULL,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
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

        UPDATE
            saVendedor
        SET co_ven = @sCo_Ven, tipo = @sTipo, ven_des = @sVen_Des, dis_cen = @sDis_Cen, cedula = @sCedula,
            direc1 = @sDirec1, direc2 = @sDirec2, telefonos = @sTelefonos, fecha_reg = @sdFecha_Reg,
            inactivo = @bInactivo, comision = @deComision, comentario = @sComentario, fun_cob = @bFun_Cob,
            fun_ven = @bFun_Ven, comisionv = @deComisionV, login = @sLogin
```
