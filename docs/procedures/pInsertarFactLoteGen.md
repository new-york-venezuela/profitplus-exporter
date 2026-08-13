# SP: pInsertarFactLoteGen
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: [pInsertarFactLoteGen]
*DESCRIPCIÓN	: Inserta un FactLoteGen
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarFactLoteGen]
    (
      @sco_fact_lote_gen char(6)  ,
	  @sdescrip varchar(60)  = NULL ,
	  @bprocesado bit  ,
	  @dfecha datetime ,
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
	  @sco_sucu char(6) = NULL ,
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

        INSERT  INTO stgFactLoteGen
                ( co_fact_lote_gen,descrip,fecha,procesado,co_cli_d,co_cli_h,co_serie_fact, co_serie_nctrl,man_ven_pl,man_cond_pl,fec_emis,fec_venc,fec_reg,man_fec_emis,
					man_fec_venc,man_fec_reg,prec_vta_act,co_usuario,co_sucu,co_plan_vta,sp_usuario,arch_cod, campo1, campo2, campo3, campo4, campo5, 
					campo6, campo7, campo8,co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sco_fact_lote_gen, @sdescrip,@dfecha,@bprocesado,@sco_cli_d,@sco_cli_h,@sco_serie_fact, @sco_serie_nctrl,@bman_ven_pl,@bman_cond_pl,@dfec_emis,@dfec_venc,
				  @dfec_reg,@bman_fec_emis,@bman_fec_venc,
```
