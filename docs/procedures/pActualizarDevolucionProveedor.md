# SP: pActualizarDevolucionProveedor
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			:	pActualizarDevolucionProveedor
*DESCRIPCIÓN	:	Actualiza una devolucion de compra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	Softech
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarDevolucionProveedor]
    (
      @sDoc_Num CHAR(20) ,
      @sDoc_NumOri CHAR(20) ,
      @sNro_Fact CHAR(20) ,
      @sDescrip VARCHAR(60) ,
      @sCo_Prov CHAR(16) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL ,
      @sCo_Mone CHAR(6) ,
      @sCo_Cond CHAR(6) ,
      @sPorc_Desc_Glob CHAR(15) ,
      @sPorc_Reca CHAR(15) ,
      @sStatus CHAR(1) ,
      @sN_Control CHAR(20) ,
      @sdFec_Emis SMALLDATETIME ,
      @sdFec_Venc SMALLDATETIME ,
      @sdFec_Reg SMALLDATETIME ,
      @deTasa DECIMAL(21, 8) ,
      @deSaldo DECIMAL(18, 2) ,
      @deTotal_Bruto DECIMAL(18, 2) ,
      @deTotal_Neto DECIMAL(18, 2) ,
      @deMonto_Desc_Glob DECIMAL(18, 2) ,
      @deMonto_Reca DECIMAL(18, 2) ,
      @deOtros1 DECIMAL(18, 2) ,
      @deOtros2 DECIMAL(18, 2) ,
      @deOtros3 DECIMAL(18, 2) ,
      @deMonto_Imp DECIMAL(18, 2) ,
      @deMonto_Imp2 DECIMAL(18, 2) ,
      @deMonto_Imp3 DECIMAL(18, 2) ,
      @bAnulado BIT ,
      @bImpresa BIT ,
	--@iSeriales_S			INT,
      @sSalestax CHAR(8) ,
      @sDis_Cen VARCHAR (MAX)= NULL ,
      @sDir_Ent VARCHAR(MAX) ,
      @sComentario VARCHAR(MAX) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @tsValidador TIMESTAMP ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sCo_Tipo_Doc CHAR(6) = NULL ,
      @sNro_Doc CHAR(20) = NULL ,
      @sMov_Num_b CHAR(20) = NULL ,
      @sMov_Num_c CHAR(20) = NULL ,
      @sN_Control_NCR CHAR(20) = NULL,
      @bNac BIT 
    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIM
```
