# SP: pInsertarDocumentoVenta
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pInsertarDocumentoVenta]
*DESCRIPCIÓN	:	Inserta un registro en la tabla  saDocumentoVenta
*AUTOR			:	SOFTECH SISTEMAS
*FECHA CREACIÖN	:	17/06/2010
*LASTUPDATE DATE:   2020-07-27
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarDocumentoVenta]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @sCo_Cli CHAR(16) ,
      @sCo_Ven CHAR(6) ,
      @sCo_Mone CHAR(6) ,
      @sMov_Ban CHAR(20) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL,
      @deTasa DECIMAL(21, 8) ,
      @sObserva VARCHAR(MAX) ,
      @sdFec_Reg SMALLDATETIME ,
      @sdFec_Emis SMALLDATETIME ,
      @sdFec_Venc SMALLDATETIME ,
      @bAnulado BIT ,
      @bAut BIT ,
      @bContrib BIT ,
      @sDoc_Orig CHAR(6) ,
      @sNro_Orig VARCHAR(20) ,
      @sNro_Che VARCHAR(20) ,
      @deMonto_Imp DECIMAL(18, 2) ,
      @deSaldo DECIMAL(18, 2) ,
      @deTotal_Bruto DECIMAL(18, 2) ,
      @deMonto_Desc_Glob DECIMAL(18, 2) ,
      @sPorc_Desc_Glob VARCHAR(15) ,
      @sPorc_Reca VARCHAR(15) ,
      @deMonto_Reca DECIMAL(18, 2) ,
      @deTotal_Neto DECIMAL(18, 2) ,
      @deMonto_Imp2 DECIMAL(18, 2) ,
      @deMonto_Imp3 DECIMAL(18, 2) ,
      @sTipo_Imp CHAR(1) ,
      @iTipo_Origen INT = NULL ,
      @dePorc_Imp DECIMAL(18, 5) = NULL ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @sNum_Comprobante CHAR(14) ,
      @sN_Control VARCHAR(20) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deComis1 DECIMAL(18, 2) ,
      @deComis2 DECIMAL(18, 2) ,
      @deComis3 DECIMAL(18, 2) ,
      @deComis4 DECIMAL(18, 2) ,
      @deComis5 DECIMAL(18, 2) ,
      @deComis6 DECIMAL(18, 2) ,
      @deAdicional DECIMAL(18, 2) ,
      @sSalestax CHAR(8) ,
      @bVen_Ter BIT ,
      @sImpfis VARCHAR(20) = NULL ,
      @sImpfisfac VARCHAR(15) = NULL ,
      @sImp_nro_z CHAR(15) = NULL ,
      @deOtros1 DECIMAL(18, 2) ,
      @deOtros2 DECIMAL(18, 2) ,
      @deOtros3 DECIMAL(18, 2) ,
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
      @sCo_Sucu_In CHAR(6) = NULL ,
```
