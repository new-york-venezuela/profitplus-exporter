# SP: pInsertarRenglonesOrdenPago
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesOrdenPago
DESCRIPCION	: Inserta un registro de la tabla saOrdenPagoReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesOrdenPago]
    (
      @iRENG_NUM INT ,
      @sOrd_Num CHAR(20) ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sCo_Islr CHAR(6) ,
      @deMonto_D DECIMAL(18, 5) ,
      @deMonto_H DECIMAL(18, 5) ,
      @deMonto_Iva DECIMAL(18, 5) ,
      @dePorc_Retn DECIMAL(18, 5) ,
      @deSustraendo DECIMAL(18, 5) ,
      @deMonto_Reten DECIMAL(18, 5) ,
      @sTipo_Imp CHAR(1) ,
      @sDescrip VARCHAR(MAX) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sco_sucu_in CHAR(6) = NULL ,
      @sco_us_in CHAR(6) ,
      @sREVISADO CHAR(1) = NULL ,
      @sTRASNFE CHAR(1) = NULL ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        INSERT  INTO saOrdenPagoReng
                ( reng_num, ord_num, co_cta_ingr_egr, co_islr, monto_d, monto_h, monto_iva, porc_retn, sustraendo,
                  monto_reten, tipo_imp, descrip, dis_cen, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iRENG_NUM, @sOrd_Num, @sCo_Cta_Ingr_Egr, @sCo_Islr, @deMonto_D, @deMonto_H, @deMonto_Iva,
                  @dePorc_Retn, @deSustraendo, @deMonto_Reten, @sTipo_Imp, @sDescrip, @sDis_Cen, @sco_us_in,
                  @sco_sucu_in, GETDATE(), @sco_us_in, @sco_sucu_in, GETDATE(), @sREVISADO, @sTRASNFE )
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'pInsertarRenglonesOrdenPago', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I',
            @sMaquina = @sMaquina, @sCampos = @sOrd_Num
		
        SELECT
```
