# SP: pActualizarMovimientoCaja
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pActualizarMovimientoCaja
*DESCRIPCIÓN	: Actualiza un movimiento de caja..
*AUTOR			: Softech
**************************************************************************/

CREATE PROCEDURE [pActualizarMovimientoCaja]
    (
      @sMov_Num CHAR(20) ,
      @sMov_NumOri CHAR(20) ,
      @sdFecha SMALLDATETIME ,
      @sDescrip VARCHAR(60) ,
      @sCod_Caja CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sTipo_Mov CHAR(6) ,
      @sForma_Pag CHAR(6) ,
      @sNum_Pago VARCHAR(20) ,
      @sCo_Ban CHAR(6) ,
      @sCo_Tar CHAR(6) ,
	  @sCo_Vale CHAR(6) = NULL ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @deMonto DECIMAL(18, 2) ,
      @bSaldo_Ini BIT ,
      @sOrigen CHAR(3) ,
      @sDoc_Num VARCHAR(20) ,
      @sDep_Num CHAR(20) = NULL ,
      @bAnulado BIT ,
      @bDepositado BIT ,
      @bConciliado BIT ,
      @bTransferido BIT ,
      @sMov_Nro VARCHAR(20) ,
      @sdFecha_Che SMALLDATETIME ,
      @deAux01 DECIMAL(18, 5) = NULL ,
      @sAux02 VARCHAR(30) = NULL ,
      @dFeccom SMALLDATETIME = NULL ,
      @iNumcom INT = NULL ,
      @sDis_Cen VARCHAR(MAX) = NULL ,
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
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
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

        UPDATE
            [saMovimientoCaja]
        SET [mov_num] = @sMov_Num, [fecha] = @sdFecha, [descrip] = @sDescrip, [cod_caja] = @sCod_Caja, [tasa] = @deTasa,
            [tipo_mov] = @sTipo_Mov, [forma_pag] = @sForma_Pag, [num_pago] = @sNum_Pago, [co_ban] = @sCo_Ban,
            [co_tar] = @sCo_Tar, [co_vale] = @sCo_Vale, [co_cta_ingr_egr] = @sCo_Cta_Ingr_Egr,
            [monto_h] = CASE WHEN @sTipo_
```
