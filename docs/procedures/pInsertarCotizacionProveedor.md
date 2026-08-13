# SP: pInsertarCotizacionProveedor
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)

## Código (excerpt)
```sql
/************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pInsertarCotizacionProveedor
*DESCRIPCIÓN	: Inserta una compra
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarCotizacionProveedor]
    (
      @sDoc_Num CHAR(20) ,
      @sNro_Fact CHAR(20) ,
      @sDescrip VARCHAR(60) = NULL ,
      @sCo_Prov CHAR(16) ,
	  @sCo_Cta_Ingr_Egr CHAR(20) = NULL ,
      @sCo_Mone CHAR(6) ,
      @sCo_Cond CHAR(6) = NULL ,
      @sN_Control CHAR(20) = NULL ,
      @sPorc_Desc_Glob CHAR(15) = NULL ,
      @sdFec_Emis SMALLDATETIME ,
      @sdFec_Venc SMALLDATETIME ,
      @sdFec_Reg SMALLDATETIME ,
      @bAnulado BIT ,
      @sStatus CHAR(1) ,
      @deTasa DECIMAL(21, 8) ,
      @sPorc_Reca CHAR(15) = NULL ,
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
      @sDir_Ent VARCHAR(MAX) = NULL ,
      @sComentario VARCHAR(MAX) = NULL ,
      @bImpresa BIT ,
   --@iSeriales_e			INT,
      @sSalestax CHAR(8) ,
      @sDis_Cen VARCHAR (MAX)= NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60), 
      @bNac BIT
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saCotizacionProveedor
                ( doc_num, nro_fact, descrip, co_prov, co_mone, co_cond, porc_desc_glob, porc_reca, status, n_control,
                  fec_emis, fec_venc, fec_reg, tasa, saldo, total_bruto, total_neto, monto_desc_glob, monto_reca, otros1,
```
