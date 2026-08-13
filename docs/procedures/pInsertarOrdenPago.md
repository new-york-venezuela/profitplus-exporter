# SP: pInsertarOrdenPago
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPago`](../tables/saOrdenPago.md)

## Código (excerpt)
```sql
/************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pInsertarOrdenPago
*DESCRIPCIÓN	: Inserta una Orden de Pago
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarOrdenPago]
    (
      @sOrd_Num CHAR(20) ,
      @sStatus CHAR(1) ,
      @sdFecha SMALLDATETIME ,
      @sCod_Ben CHAR(10) ,
      @sDescrip VARCHAR(MAX) ,
      @sForma_Pag CHAR(2) ,
      @sdFec_Pag SMALLDATETIME ,
      @sCod_Cta CHAR(6) ,
      @sDoc_Num CHAR(20) ,
      @sCod_Caja CHAR(6) ,
      @sMov_Num_C CHAR(20) ,
      @sMov_Num_B CHAR(20) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deTasa DECIMAL(21,8) ,
      @sCo_mone CHAR(6) ,
      @bAnulado BIT ,
      @bSino_Reten BIT ,
      @iPagar INT ,
      @sOrigen CHAR(3) ,
      @sOrigen_D CHAR(20) ,
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
      @sTrasnfe CHAR(1) = NULL
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

        INSERT  INTO saOrdenPago
                ( ord_num, status, fecha, cod_ben, descrip, forma_pag, fec_pag, cod_cta, doc_num, cod_caja, mov_num_c,
                  mov_num_b, dis_cen, tasa, co_mone, anulado, sino_reten, pagar, origen, origen_d, campo1, campo2,
                  campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sOrd_Num, @sStatus, @sdFecha, @sCod_Ben, @sDescrip, @sForma_Pag, @sdFec_Pag, @sCod_Cta, @sDoc_Num,
                  @sCod_Caja, @sMov_Num_C, @sMov_Num_B, @sDis_Cen, @deTasa, @sCo_mone, @bAnulado, @bSino_Reten, @iPagar,
                  @sOrigen, @sOrigen
```
