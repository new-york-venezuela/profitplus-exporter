# SP: pActualizarRenglonesFacturaVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pActualizarRenglonesVentaReng
DESCRIPCION	: Actualiza un registro de la tabla saFacturaVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesFacturaVenta]
    (
      @iReng_Num INT ,
      @sDoc_Num CHAR(20) ,
      @iReng_NumOri INT ,
      @sDoc_NumOri CHAR(20) ,
      @sCo_Art CHAR(30) ,
      @sDes_Art VARCHAR(120) = NULL ,
      @sCo_Alma CHAR(6) ,
      @sCo_Uni CHAR(6) ,
      @sSco_Uni CHAR(6) = NULL ,
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
      @sTipo_Doc VARCHAR(4) ,
      @gRowguid_Doc UNIQUEIDENTIFIER ,
      @sNum_Doc VARCHAR(20) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @deMonto_Imp DECIMAL(18, 5) ,
      @deMonto_Imp2 DECIMAL(18, 5) ,
      @deMonto_Imp3 DECIMAL(18, 5) ,
      @deOtros DECIMAL(18, 5) ,
      @deOtros1_Glob DECIMAL(18, 5) ,
      @deOtros2_Glob DECIMAL(18, 5) ,
      @deOtros3_Glob DECIMAL(18, 5) ,
      @deTotal_Dev DECIMAL(18, 5) = NULL ,
      @deMonto_Dev DECIMAL(18, 5) ,
      @sComentario VARCHAR(MAX) = NULL ,
      @dePendiente2 DECIMAL(18, 5) ,
      @deMonto_desc_glob DECIMAL(18, 5) ,
      @deMonto_reca_glob DECIMAL(18, 5) ,
      @deMonto_imp_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp2_afec_glob DECIMAL(18, 5) ,
      @deMonto_imp3_afec_glob DECIMAL(18, 5) ,
      @sDis_Cen VARCHAR (MAX) = NULL ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
      @sMaquina VARCHAR(60) = NULL ,
      @growguid UNIQUEIDENTIFIER ,
      @sCampos VARCHAR(MAX)
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              sCoArtOri CHAR(30) ,
              sCoArtNew CHAR(30) ,
              sCoAlmaOri CHAR(6) ,
              sCoA
```
