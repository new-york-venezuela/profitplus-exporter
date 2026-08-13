# SP: pActualizarRenglonesDocumentoVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesDocumentoVenta
DESCRIPCION	: Inserta un registro de la tabla saDocumentoVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesDocumentoVenta]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sCo_Tipo_DocOri CHAR(6) ,
      @sNro_DocOri CHAR(20) ,
      @sNro_Doc CHAR(20) ,
      @sCo_Art CHAR(30) = NULL ,
      @sArt_Des VARCHAR(120) ,
      @sPorc_desc VARCHAR(15) = NULL ,
      @sCo_alma CHAR(6) ,
      @sCo_Uni CHAR(6) = NULL ,
      @sCo_precio CHAR(6) = NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @dePrec_Vta DECIMAL(18, 5) ,
      @sTipo_Imp CHAR(1) = NULL ,
      @sTipo_Imp2 CHAR(6) ,
      @sTipo_Imp3 CHAR(6) ,
      --@dePrec_Vta_Om DECIMAL(18, 5) ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @deMonto_imp_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp2_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp3_afec_glob DECIMAL(18, 5) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @deMonto_Imp DECIMAL(18, 5) ,
      @deMonto_Imp2 DECIMAL(18, 5) ,
      @deMonto_Imp3 DECIMAL(18, 5) ,
      @deMonto_desc DECIMAL(18, 5) ,
      @deMonto_desc_glob DECIMAL(18, 5) ,
      @deMonto_reca_glob DECIMAL(18, 5) ,
      @deOtros DECIMAL(18, 5) ,
      @deOtros1_glob DECIMAL(18, 5) ,
      @deOtros2_glob DECIMAL(18, 5) ,
      @deOtros3_glob DECIMAL(18, 5) ,
      @deReng_Neto DECIMAL(18, 2) ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
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


        UPDATE
            saDocumentoVentaReng
        SET reng_num = @iReng_Num, co_tipo_doc = @sCo_Tipo_Doc, nro_doc = @sNro_Doc, co_art = @sCo_Art,
            des_art = @sArt_Des, porc_desc = @s
```
