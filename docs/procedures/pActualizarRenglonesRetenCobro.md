# SP: pActualizarRenglonesRetenCobro
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saCobroRentenReng`](../tables/saCobroRentenReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarRenglonesRetenCobro
*DESCRIPCIÓN	:	Actualiza un registro de retencion relacionado a un documento de Cobro
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO		:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pActualizarRenglonesRetenCobro]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER ,
      @gRowguid_Reng_CobOri UNIQUEIDENTIFIER ,
      @deMonto DECIMAL(18, 5) ,
      @deMonto_Reten DECIMAL(18, 5) ,
      @deSustraendo DECIMAL(18, 5) ,
      @dePorc_Retn DECIMAL(18, 5) ,
      @deMonto_Obj DECIMAL(18, 5) ,
      @sCo_Islr CHAR(6) ,
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @growguid UNIQUEIDENTIFIER ,
      @sCampos VARCHAR(MAX),
      @gRowguid_fact UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
		
        UPDATE
            saCobroRentenReng
        SET reng_num = @iRENG_NUM, rowguid_reng_cob = @gRowguid_Reng_Cob, co_islr = @sCo_Islr, monto = @deMonto,
            monto_reten = @deMonto_Reten, monto_obj = @deMonto_Obj, sustraendo = @deSustraendo, porc_retn = @dePorc_Retn,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sREVISADO,
            trasnfe = @sTRASNFE, rowguid_fact = @gRowguid_fact
        OUTPUT
            Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng_cob = @gRowguid_Reng_CobOri
            AND reng_num = @iRENG_NUMOri		
        

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saPagoRentenReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos
		
        SELECT
            *
        FROM
            @TableTimestamp
```
