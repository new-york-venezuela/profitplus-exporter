# SP: pActualizarRenglonesOrdenPago
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesOrdenPago
DESCRIPCION	: Actualiza un registro de la tabla saOrdenPagoReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesOrdenPago]
    (
      @iRENG_NUM INT ,
      @sOrd_Num CHAR(20) ,
      @iRENG_NUMOri INT ,
      @sOrd_NumOri CHAR(20) ,
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
      @sco_sucu_mo CHAR(6) ,
      @sco_us_mo CHAR(6) ,
      @sREVISADO CHAR(1) = NULL ,
      @sTRASNFE CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) ,
      @growguid UNIQUEIDENTIFIER ,
      @sCampos VARCHAR(MAX)
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        UPDATE
            saOrdenPagoReng
        SET reng_num = @iRENG_NUM, ord_num = @sOrd_Num, co_cta_ingr_egr = @sCo_Cta_Ingr_Egr, co_islr = @sCo_Islr,
            monto_d = @deMonto_D, monto_h = @deMonto_H, monto_iva = @deMonto_Iva, porc_retn = @dePorc_Retn,
            sustraendo = @deSustraendo, monto_reten = @deMonto_Reten, tipo_imp = @sTipo_Imp, descrip = @sDescrip,
            dis_cen = @sDis_Cen, co_us_mo = @sco_us_mo, co_sucu_mo = @sco_sucu_mo, fe_us_mo = GETDATE(),
            revisado = @sREVISADO, trasnfe = @sTRASNFE
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            ord_num = @sOrd_NumOri
            AND reng_num = @iReng_NumOri
	
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDepositoBancoReng', @rowguidOri = @rowGuid
```
