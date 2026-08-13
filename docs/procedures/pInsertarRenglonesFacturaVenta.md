# SP: pInsertarRenglonesFacturaVenta
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesFacturaVenta
DESCRIPCION	: Inserta un registro de la tabla saFacuraVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarRenglonesFacturaVenta]
    (
      @iReng_Num INT ,
      @sDoc_Num CHAR(20) ,
      @sCo_Art CHAR(30) ,
      @sDes_Art VARCHAR(120) = NULL ,
      @sCo_Uni CHAR(6) ,
      @sSco_Uni CHAR(6) = NULL ,
      @sCo_Alma CHAR(6) ,
      @sCo_Precio CHAR(6) = NULL ,
      @sTipo_Imp CHAR(1) ,
      @sTipo_Imp2 CHAR(1) = NULL ,
      @sTipo_Imp3 CHAR(1) = NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art DECIMAL(18, 5) ,
      @dePrec_Vta DECIMAL(18, 5) ,
      @sPorc_Desc VARCHAR(15) = NULL ,
      @deMonto_Desc DECIMAL(18, 5) = NULL ,
      @deReng_Neto DECIMAL(18, 2) ,
      @dePendiente DECIMAL(18, 5) ,
      @dePendiente2 DECIMAL(18, 5) ,
      @deMonto_Desc_Glob DECIMAL(18, 5) ,
      @deMonto_reca_Glob DECIMAL(18, 5) ,
      @deOtros1_glob DECIMAL(18, 5) ,
      @deOtros2_glob DECIMAL(18, 5) ,
      @deOtros3_glob DECIMAL(18, 5) ,
      @deMonto_imp_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp2_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp3_afec_glob DECIMAL(18, 5) ,
      @sTipo_Doc CHAR(4) ,
      @gRowguid_Doc UNIQUEIDENTIFIER ,
      @sNum_Doc VARCHAR(20) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @deMonto_Imp DECIMAL(18, 5) ,
      @deMonto_Imp2 DECIMAL(18, 5) ,
      @deMonto_Imp3 DECIMAL(18, 5) ,
      @deOtros DECIMAL(18, 5) = NULL ,
      @deTotal_Dev DECIMAL(18, 5) ,
      @deMonto_Dev DECIMAL(18, 5) = NULL ,
      @sComentario VARCHAR(MAX) ,
      @sDis_Cen VARCHAR (MAX)= NULL ,
      @sCo_Sucu_In CHAR(6) ,
      @sCo_Us_In CHAR(6) ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
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
	
        INSERT  INTO saFacturaVentaReng
                ( reng_num, doc_num, co_art, des_art, co_uni, sco_uni, co_alma, co_precio, tipo_imp, tipo_imp2,
                  tipo_imp3, total_art, stotal_
```
