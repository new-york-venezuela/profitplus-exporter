# SP: pActualizarPago
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)

## Código (excerpt)
```sql
/**************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: [pActualizarPago]
*DESCRIPCIÓN	: Actualiza Pago
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarPago]
    (
      @sCob_Num CHAR(20) ,
      @sCob_NumOri CHAR(20) ,
      @sRecibo CHAR(15) ,
      @sCo_Prov CHAR(16) ,
      @sCo_Mone CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sdFecha SMALLDATETIME ,
      @bAnulado BIT ,
      @deMonto DECIMAL(18, 2) ,
      @sDis_cen VARCHAR (MAX) = NULL ,
      @sDescrip VARCHAR(60) ,
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
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX)
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
            [saPago]
        SET [cob_num] = @sCob_Num, [recibo] = @sRecibo, [descrip] = @sDescrip, [co_prov] = @sCo_Prov,
            [co_mone] = @sCo_Mone, [tasa] = @deTasa, [fecha] = @sdFecha, [anulado] = @bAnulado, [monto] = @deMonto,
            [dis_cen] = @sDis_cen, [campo1] = @sCampo1, [campo2] = @sCampo2, [campo3] = @sCampo3, [campo4] = @sCampo4,
            [campo5] = @sCampo5, [campo6] = @sCampo6, [campo7] = @sCampo7, [campo8] = @sCampo8, [co_us_mo] = @sCo_Us_Mo,
            [co_sucu_mo] = @sCo_Sucu_Mo, [fe_us_mo] = GETDATE(), [revisado] = @sRevisado, [trasnfe] = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            [cob_num] = @sCob_NumOri
            AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
```
