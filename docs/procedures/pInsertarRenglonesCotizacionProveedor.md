# SP: pInsertarRenglonesCotizacionProveedor
**Tipo**: Insertar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pInsertarRenglonesCotizacionProveedor
*DESCRIPCIÓN	:	Inserta un renglon de compra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesCotizacionProveedor]
    (
      @iReng_Num INT ,
      @sDoc_Num CHAR(20) ,
      @sCo_Art CHAR(30) ,
      @sDes_Art VARCHAR(120) ,
      @sCo_Uni CHAR(6) ,
      @sSCo_Uni CHAR(6) = NULL ,
      @sCo_Alma CHAR(6) ,
      @sTipo_Imp CHAR(1) ,
      @sTipo_Imp2 CHAR(1) = NULL ,
      @sTipo_Imp3 CHAR(1) = NULL ,
      @sTipo_Doc CHAR(4) = NULL ,
      @sPorc_Desc CHAR(15) = NULL ,
      @sNum_Doc CHAR(20) ,
      @gRowGuid_Doc UNIQUEIDENTIFIER ,
      @deReng_Neto DECIMAL(18, 2) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @deCost_Unit_OM DECIMAL(18, 5) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art DECIMAL(18, 5) ,
      @deOtros DECIMAL(18, 5) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @deMonto_Imp DECIMAL(18, 5) ,
      @deMonto_Imp2 DECIMAL(18, 5) ,
      @deMonto_Imp3 DECIMAL(18, 5) ,
      @dePorc_Gas DECIMAL(18, 2) ,
      @deTotal_Dev DECIMAL(18, 5) ,
      @deMonto_Dev DECIMAL(18, 5) ,
      @dePendiente2 DECIMAL(18, 5) ,
      @sComentario VARCHAR(MAX) ,
      @bLote_Asignado BIT ,
      @deMonto_Desc_Glob DECIMAL(18, 5) ,
      @deMonto_reca_Glob DECIMAL(18, 5) ,
      @deOtros1_glob DECIMAL(18, 5) ,
      @deOtros2_glob DECIMAL(18, 5) ,
      @deOtros3_glob DECIMAL(18, 5) ,
      @deMonto_imp_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp2_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp3_afec_glob DECIMAL(18, 5) ,
      @deMonto_Desc DECIMAL(18, 5) ,
      @dePendiente DECIMAL(18, 5) ,
      @iReng_Doc INT ,
      @sDis_Cen VARCHAR (MAX) = NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Us_In CHAR(6) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sMaquina VARCHAR(60) = NULL ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

		/*La cantidad de pendiente es igual a la cantidad de renglones insertada
```
