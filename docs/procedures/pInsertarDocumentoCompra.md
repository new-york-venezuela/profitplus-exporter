# SP: pInsertarDocumentoCompra
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/*********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pInsertarDocumentoCompra
*DESCRIPCIÓN	:	Inserta un registro en la tabla  saDocumentoCompra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO		:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [dbo].[pInsertarDocumentoCompra]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @sNro_Fact CHAR(20) ,
      @sCo_Mone CHAR(6) ,
      @sCo_Prov CHAR(16) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL ,
      @sDoc_Orig CHAR(6) = NULL ,
      @sMov_Ban CHAR(20) ,
      @sNro_Orig CHAR(20) = NULL ,
      @sNro_Che CHAR(20) ,
      @sPorc_Reca CHAR(15) ,
      @sPorc_Desc_Glob CHAR(15) ,
      @bAnulado BIT ,
      @bAut BIT ,
      @iPagar INT ,
      @sObserva VARCHAR(120) = NULL ,
      @sTipo_Imp CHAR(1) ,
      @sTipo_Imp2 CHAR(1) = NULL ,
      @sTipo_Imp3 CHAR(1) = NULL ,
      @sdFec_Reg SMALLDATETIME ,
      @sdFec_Emis SMALLDATETIME ,
      @sdFec_Venc SMALLDATETIME ,
      @deTotal_Neto DECIMAL(18, 2) ,
      @deTasa DECIMAL(21, 8) ,
      @dePorc_Imp DECIMAL(18, 5) = NULL ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @deMonto_Imp DECIMAL(18, 2) ,
      @deMonto_Imp2 DECIMAL(18, 2) ,
      @deMonto_Imp3 DECIMAL(18, 2) ,
      @deTotal_Bruto DECIMAL(18, 2) ,
      @deMonto_Desc_Glob DECIMAL(18, 2) ,
      @deMonto_Reca DECIMAL(18, 2) ,
      @deSaldo DECIMAL(18, 2) ,
      @deAdicional DECIMAL(18, 2) ,
      @deOtros1 DECIMAL(18, 2) ,
      @deOtros2 DECIMAL(18, 2) ,
      @deOtros3 DECIMAL(18, 2) ,
      @sPro_Pago VARCHAR(MAX) ,
      @sSalestax CHAR(8) ,
      @sProv_Ter CHAR(16) = NULL ,
      @iReng_Ter INT ,
      @iTipo_Origen INT = NULL ,
      @sNum_Comprobante CHAR(14) ,
      @sDis_Cen VARCHAR(MAX) ,
      @sN_Control CHAR(20) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sco_sucu_in CHAR(6) = NULL ,
      @sco_us_in CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL,
      @bNac BIT
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
```
