# SP: pInsertarRenglonesRetenCobro
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saCobroRentenReng`](../tables/saCobroRentenReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarRenglonesRetenCobro
*DESCRIPCIÓN	:	Inserta un registro de retencion relacionado a un documento de Cobro
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO		:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesRetenCobro]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER ,
      @deMonto DECIMAL(18, 5) ,
      @deMonto_Reten DECIMAL(18, 5) ,
      @deSustraendo DECIMAL(18, 5) ,
      @dePorc_Retn DECIMAL(18, 5) ,
      @deMonto_Obj DECIMAL(18, 5) ,
      @bAutomatica BIT ,
      @sCo_Islr CHAR(6) ,
      @iRENG_NUM INT ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
      @sco_sucu_in CHAR(6) = NULL ,
      @sco_us_in CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL,
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
		
		
        INSERT  INTO saCobroRentenReng
                ( reng_num, rowguid_reng_cob, co_islr, monto, monto_reten, monto_obj, automatica, sustraendo, porc_retn,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, rowguid_fact )
        OUTPUT  Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iRENG_NUM, @gRowguid_Reng_Cob, @sCo_Islr, @deMonto, @deMonto_Reten, @deMonto_Obj, @bAutomatica,
                  @deSustraendo, @dePorc_Retn, @sco_us_in, @sco_sucu_in, GETDATE(), @sco_us_in, @sco_sucu_in, GETDATE(),
                  @sREVISADO, @sTRASNFE, @gRowguid_fact )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saCobroRentenReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @gRowguid_Reng_Cob
		
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
