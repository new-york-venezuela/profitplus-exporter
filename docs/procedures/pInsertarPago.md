# SP: pInsertarPago
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)

## Código (excerpt)
```sql
/************************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: [pInsertarPago]
*DESCRIPCIÓN	: Inserta un convenio
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pInsertarPago]
    (
      @sCob_Num CHAR(20) ,
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

        INSERT  INTO [saPago]
                ( [cob_num], [recibo], [descrip], [co_prov], [co_mone], [tasa], [fecha], [anulado], [monto], [dis_cen],
                  [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [co_us_in],
                  [co_sucu_in], [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe] )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCob_Num, @sRecibo, @sDescrip, @sCo_Prov, @sCo_Mone, @deTasa, @sdFecha, @bAnulado, @deMonto,
                  @sDis_cen, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sC
```
