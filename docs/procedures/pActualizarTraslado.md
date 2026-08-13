# SP: pActualizarTraslado
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/**********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE: pActualizarTraslado
*DESCRIPCIÓN : Actualización de Traslado entre Almacen
*AUTOR: SOFTECH SISTEMAS
***********************************************************************/

CREATE PROCEDURE [dbo].[pActualizarTraslado]
    (
      @sTras_Num CHAR(20) ,
      @sTras_NumOri CHAR(20) ,
      @sCo_Mone CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sMotivo_Glo VARCHAR(60) ,
      @sdFecha SMALLDATETIME ,
      @sAlm_Orig CHAR(6) ,
      @sAlm_Tmp CHAR(6) ,
      @sAlm_Dest CHAR(6) = NULL ,
      @bConfirma BIT ,
      @sdFec_Sal SMALLDATETIME ,
      @sdFec_Conf SMALLDATETIME = NULL ,
      @bAnulado BIT ,
    --@iSeriales_e   INT,
	--@iSeriales_s   INT,
      @deMonto_Dist DECIMAL(18, 5) ,
      @iNumcom INT = NULL ,
      @sdFeccom SMALLDATETIME = NULL ,
      @sDis_cen VARCHAR(MAX) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
	  @sN_Control CHAR(20) ,
	  @sCo_Tran CHAR(6),
	  @sCo_cond CHAR(6)
    )
AS 
    BEGIN		
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER ,
              anuladaOld BIT ,
              anuladaNew BIT ,
              confirmaOld BIT ,
              confirmaNew BIT
            ) ;
		
        UPDATE
            saTraslado
        SET tras_num = @sTras_Num, motivo_glo = @sMotivo_Glo, co_mone = @sCo_Mone, tasa = @deTasa, fecha = @sdFecha,
            alm_orig = @sAlm_Orig, alm_tmp = @sAlm_Tmp, alm_dest = @sAlm_Dest, confirma = @bConfirma, fec_sal = @sdFecha,
            fec_conf = @sdFec_Conf, anulado = @bAnulado,
			--seriales_e = @iSeriales_e,
			--seriales_s = @iSeriales_s,
            monto_Dist = @deMonto_Dist, numcom = @iNumcom, feccom = @sdFeccom, dis_cen =
```
