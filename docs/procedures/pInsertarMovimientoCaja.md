# SP: pInsertarMovimientoCaja
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pInsertarMovimientoCaja
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [pInsertarMovimientoCaja]
    (
      @sMov_Num CHAR(20) ,
      @sdFecha SMALLDATETIME ,
      @sDescrip VARCHAR(60) ,
      @sCod_Caja CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sTipo_Mov CHAR(2) ,
      @sForma_Pag CHAR(2) ,
      @sNum_Pago VARCHAR(20) ,
      @sCo_Ban CHAR(6) ,
      @sCo_Tar CHAR(6) ,
	  @sCo_Vale CHAR(6) = NULL ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @deMonto DECIMAL(18, 2) ,
      @bSaldo_Ini BIT ,
      @sOrigen CHAR(3) ,
      @sDoc_Num VARCHAR(20) ,
      @sDep_Num VARCHAR(20) ,
      @bAnulado BIT ,
      @bDepositado BIT ,
      @bConciliado BIT ,
      @bTransferido BIT ,
      @sMov_Nro VARCHAR(20) = NULL,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
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

        INSERT  INTO saMovimientoCaja
                ( [mov_num], [fecha], [descrip], [cod_caja], [tasa], [tipo_mov], [forma_pag], [num_pago], [co_ban],
                  [co_tar], [co_vale], [co_cta_ingr_egr], [monto_d], [monto_h], [saldo_ini], [origen], [doc_num], [dep_num],
                  [anulado], [depositado], [transferido], [mov_nro], [fecha_che], [aux01], [aux02], [feccom], [numcom],
                  [dis_cen], [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [co_us_in],
                  [co_sucu_in], [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [t
```
