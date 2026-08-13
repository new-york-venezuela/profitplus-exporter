# SP: pActualizarDevolucionCliente
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pActualizarDevolucionCliente
*DESCRIPCIÓN	: actualiza una devolucion de venta
*CREATE DATE    : 2011-12-12
*LASTUPDATE DATE: 2020-07-27
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarDevolucionCliente]
    (
      @sDoc_Num CHAR(20) ,
      @sDoc_NumOri CHAR(20) ,
      @sDescrip VARCHAR(60) ,
      @sCo_Cli CHAR(16) ,
      @sCo_Tran CHAR(6) ,
      @sCo_Mone CHAR(6) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL,
      @sCo_Ven CHAR(6) ,
      @sCo_Cond CHAR(6) ,
      @sdFec_Emis SMALLDATETIME ,
      @sdFec_Venc SMALLDATETIME ,
      @sdFec_Reg SMALLDATETIME ,
      @bAnulado BIT ,
      @sStatus CHAR(1) ,
      @deTasa DECIMAL(21, 8) ,
      @sN_Control CHAR(20) ,
      @sPorc_Desc_Glob CHAR(15) = NULL ,
      @deMonto_Desc_Glob DECIMAL(18, 2) ,
      @sPorc_Reca CHAR(15) = NULL ,
      @deMonto_reca DECIMAL(18, 2) ,
      @deSaldo DECIMAL(18, 2) ,
      @deTotal_Bruto DECIMAL(18, 2) ,
      @deMonto_Imp DECIMAL(18, 2) ,
      @deMonto_Imp2 DECIMAL(18, 2) ,
      @deMonto_Imp3 DECIMAL(18, 2) ,
      @deOtros1 DECIMAL(18, 2) ,
      @deOtros2 DECIMAL(18, 2) ,
      @deOtros3 DECIMAL(18, 2) ,
      @deTotal_Neto DECIMAL(18, 2) ,
      @sComentario VARCHAR(MAX) ,
      @sDir_Ent VARCHAR(MAX) ,
      @bContrib BIT ,
      @bImpresa BIT ,
	  --@iSeriales_E       INT, 
      @sSalestax CHAR(8) ,
      @sImpfis VARCHAR(20) = NULL ,
      @sImpfisfac VARCHAR(15) = NULL ,
	  @sImp_Nro_Z VARCHAR(15) = NULL ,
      @bVen_Ter BIT ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
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
      @gRowguid UNIQUEIDENTIFIER = NULL 	
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEI
```
