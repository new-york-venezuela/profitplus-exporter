# SP: pActualizarDocumentoVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pActualizarDocumentoVenta]
*DESCRIPCIÓN	:	Inserta un registro en la tabla  saDocumentoVenta
*AUTOR			:	SOFTECH SISTEMAS
*FECHA CREACION	:	21/06/2010
*LASTUPDATE DATE:   2020-07-27
*********************************************************************/

CREATE PROCEDURE [dbo].[pActualizarDocumentoVenta]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sCo_Tipo_DocOri CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @sNro_DocOri CHAR(20) ,
      @sCo_Cli CHAR(16) ,
      @sCo_Ven CHAR(6) ,
      @sCo_Mone CHAR(6) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL,
      @sMov_Ban CHAR(20) ,
      @deTasa DECIMAL(21, 8) ,
      @sObserva VARCHAR(120) = NULL ,
      @sdFec_reg SMALLDATETIME ,
      @sdFec_emis SMALLDATETIME ,
      @sdFec_venc SMALLDATETIME ,
      @bAnulado BIT ,
      @bAut BIT ,
      @bContrib BIT ,
      @sDoc_orig CHAR(6) ,
      @sNro_orig VARCHAR(20) ,
      @sNro_che VARCHAR(20) ,
      @deMonto_imp DECIMAL(18, 2) ,
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
      @dePorc_Imp DECIMAL(18, 5) = NULL ,
      @dePorc_Imp2 DECIMAL(18, 5) ,
      @dePorc_Imp3 DECIMAL(18, 5) ,
      @sNum_Comprobante CHAR(14) ,
      @iTipo_Origen INT = NULL ,
      @sN_control VARCHAR(20) ,
      @sDis_cen XML ,
      @deComis1 DECIMAL(18, 2) ,
      @deComis2 DECIMAL(18, 2) ,
      @deComis3 DECIMAL(18, 2) ,
      @deComis4 DECIMAL(18, 2) ,
      @deComis5 DECIMAL(18, 2) ,
      @deComis6 DECIMAL(18, 2) ,
      @deAdicional DECIMAL(18, 2) ,
      @sSalestax CHAR(8) ,
      @bVen_ter BIT ,
      @sImpfis VARCHAR(20) = NULL ,
      @sImpfisfac VARCHAR(15) = NULL ,
      @sImp_nro_z CHAR(15) = NULL ,
      @deOtros1 DECIMAL(18, 2) ,
      @deOtros2 DECIMAL(18, 2) ,
      @deOtros3 DECIMAL(18, 2) ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_us_mo CHAR(6) ,
      @sco_sucu_mo CHAR(6) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe
```
