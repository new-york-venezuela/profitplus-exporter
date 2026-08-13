# SP: pInsertarTraslado
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
/********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE : pInsertarTraslado
*DESCRIPCIÓN : Insertra un Traslado
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarTraslado]
    (
      @sTras_Num CHAR(20) ,
      @sMotivo_Glo CHAR(60) ,
      @sCo_Mone CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sdFecha SMALLDATETIME ,
      @sAlm_Orig CHAR(6) ,
      @sAlm_Tmp CHAR(6) ,
      @sAlm_Dest CHAR(6) ,
      @bConfirma BIT ,
      @sdFec_Sal SMALLDATETIME ,
      @sdFec_Conf SMALLDATETIME ,
      @bAnulado BIT ,
	--@iSeriales_e	INT,
	--@iSeriales_s	INT,
      @deMonto_Dist DECIMAL(18, 2) ,
      @sDis_Cen VARCHAR(MAX) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL	,
	  @sN_Control CHAR(20) ,
	   @sCo_Tran CHAR(6) ,
	   @sCo_cond CHAR(6)
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
			
        INSERT  INTO saTraslado
                ( tras_num, motivo_glo, co_mone, tasa, fecha, alm_orig, alm_tmp, alm_dest, confirma, fec_sal, fec_conf,
                  anulado, monto_dist, dis_cen, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, n_control, co_tran,co_cond)
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sTras_Num, @sMotivo_Glo, @sCo_Mone, @deTasa, @sdFecha, @sAlm_Orig, @sAlm_Tmp, @sAlm_Dest, @bConfirma,
                  @sdFecha, @sdFec_Conf, @bAnulado, @deMonto_Dist, @sDis_Cen, @sCampo1, @sCampo2, @sCampo3, @sCampo4,
                  @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
```
