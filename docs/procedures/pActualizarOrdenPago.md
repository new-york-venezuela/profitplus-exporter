# SP: pActualizarOrdenPago
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPago`](../tables/saOrdenPago.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pActualizarOrdenPago
*DESCRIPCIÓN	: Actualiza Ordenpago
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarOrdenPago]
    (
      @sOrd_Num CHAR(20) ,
      @sOrd_NumOri CHAR(20) ,
      @sDescrip VARCHAR(MAX) ,
      @sStatus CHAR(1) ,
      @sdFecha SMALLDATETIME ,
      @sCod_Ben CHAR(10) ,
      @sForma_Pag CHAR(2) ,
      @sdFec_Pag SMALLDATETIME ,
      @sCod_Cta CHAR(6) ,
      @sDoc_Num CHAR(20) ,
      @sCod_Caja CHAR(6) ,
      @sMov_Num_B CHAR(20) ,
      @sMov_Num_C CHAR(20) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deTasa DECIMAL(21,8) ,
      @sCo_Mone CHAR(6) ,
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
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 	
    )
AS 
    BEGIN	
		
        IF ( @sDoc_Num = '' ) 
            SET @sDoc_Num = NULL

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saOrdenPago
        SET ord_num = @sOrd_Num, status = @sStatus, fecha = @sdFecha, cod_ben = @sCod_Ben, descrip = @sDescrip,
            forma_pag = @sForma_Pag, fec_pag = @sdFec_Pag, cod_cta = @sCod_Cta, doc_num = @sDoc_Num,
            cod_caja = @sCod_Caja, mov_num_c = @sMov_Num_C, mov_num_b = @sMov_Num_B, dis_cen = @sDis_Cen, tasa = @deTasa,
            co_mone = @sCo_Mone, anulado = @bAnulado, sino_reten = @bSino_Reten, pagar = @iPagar, origen = @sOrigen,
            origen_d = @sOrigen_D, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5
```
