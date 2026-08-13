# SP: pActualizarFactLoteGen
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarFactLoteGen
*DESCRIPCIÓN	: Actualiza un FactLoteGen
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarFactLoteGen]
    (
      @sco_fact_lote_gen char(6)  ,
	  @sco_fact_lote_genOri char(6)  ,
	  @sdescrip varchar(60)  = NULL ,
	  @dfecha datetime ,
	  @bprocesado bit  ,
	  @sco_cli_d char(16)  = NULL ,
	  @sco_cli_h char(16)  = NULL ,
	  @sco_serie_fact char(20)  ,
	  @sco_serie_nctrl char(20)  ,
	  @bman_ven_pl bit  ,
	  @bman_cond_pl bit  ,
	  @dfec_emis smalldatetime  ,
	  @dfec_venc smalldatetime  ,
	  @dfec_reg smalldatetime  ,
	  @bman_fec_emis bit  ,
  	  @bman_fec_venc bit  ,
	  @bman_fec_reg bit  ,
	  @bprec_vta_act bit  ,
	  @sco_usuario char(6)  ,
	  @sco_sucu char(6) = NULL  ,
	  @sco_plan_vta char(20)  = NULL ,
	  @ssp_usuario char(128)  = NULL ,
	  @sarch_cod char(260)  = NULL ,
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
            stgFactLoteGen
        SET co_fact_lote_gen = @sco_fact_lote_gen, descrip = @sdescrip, fecha = @dfecha, procesado = @bprocesado, co_cli_d = @sco_cli_d, co_cli_h = @sco_cli_h, 
		co_serie_fact = @sco_serie_fact, co_serie_nctrl = @sco_serie_nctrl, man_ven_pl = @bman_ven_pl, man_cond_pl = @bman_cond_pl, 
		fec_emis = @dfec_emis, fec_venc = @dfec_venc, fec_reg = @dfec_reg, man_fec_emis = @bman_fec_emis, man_fec_venc = @bman_fec_venc, 
		man_fec_reg = @bman_fec_reg, prec_vta_act = @bprec_vta_act, co_usuario = @sco_usuario, co_sucu = @sco_sucu, co_plan_vta = @sco_plan_vta, 
		sp_usuario = @ssp_usuario, arch_cod = @sarch_cod
```
