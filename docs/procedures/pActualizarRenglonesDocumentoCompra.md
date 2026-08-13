# SP: pActualizarRenglonesDocumentoCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesDocumentoCompra
DESCRIPCION	: Inserta un registro de la tabla saDocumentoCompraReng
CREADO POR	: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesDocumentoCompra]
    (
      @iReng_Num INT ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @iReng_NumOri INT ,
      @sCo_Tipo_DocOri CHAR(6) ,
      @sNro_DocOri CHAR(20) ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Alma CHAR(6) ,
      @sDes_Art VARCHAR(120) = NULL ,
      @sCo_Uni CHAR(6) = NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @deCost_Unit_OM DECIMAL(18, 5)  = 0,
      @deReng_Neto DECIMAL(18, 2) ,
      @sTipo_Imp CHAR(1) = NULL ,
      @sTipo_Imp2 CHAR(1) = NULL ,
      @sTipo_Imp3 CHAR(1) = NULL ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @dePorc_Imp2 DECIMAL(18, 5) = NULL ,
      @dePorc_Imp3 DECIMAL(18, 5) = NULL ,
      @deMonto_imp DECIMAL(18, 5) ,
      @deMonto_imp2 DECIMAL(18, 5) ,
      @deMonto_imp3 DECIMAL(18, 5) ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
      @sPorc_Desc VARCHAR(15) = NULL ,
      @deMonto_Desc DECIMAL(18, 5) ,
      @deMonto_Desc_Glob DECIMAL(18, 5) ,
      @deMonto_Imp_Afec_Glob DECIMAL(18, 5) ,
      @deMonto_Imp2_Afec_Glob DECIMAL(18, 5) ,
      @deMonto_Imp3_Afec_Glob DECIMAL(18, 5) ,
      @deMonto_Reca_Glob DECIMAL(18, 5) ,
      @deOtros DECIMAL(18, 5) ,
      @deOtros1_Glob DECIMAL(18, 5) ,
      @deOtros2_Glob DECIMAL(18, 5) ,
      @deOtros3_Glob DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saDocumentoCompraReng
        SET reng_num = @iReng_Num, co_tipo_doc = @sCo_Tipo_Doc, nro_doc = @sNro_Doc, co_art = @sCo_Art,
```
