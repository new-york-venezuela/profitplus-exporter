# SP: pInsertarCompuestoGen
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO			:	<2011-12-12>
MODIFICADO		:	<2020-07-27>
NOMBRE: pInsertarCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarCompuestoGen]
    (
      @sGene_Num CHAR(20) ,
      @sdFecha SMALLDATETIME ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @deTasa DECIMAL(21, 8) ,
      @sCo_Mone CHAR(6) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art DECIMAL(18, 5) ,
      @deCosto_Tot DECIMAL(18, 5) ,
      @sCo_Alma CHAR(6) ,
      @bGene_Art BIT ,
--	@iSeriales_S	INT,
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
      @sTrasnfe CHAR(1) = NULL,
	  @sSCo_Uni CHAR(6) = NULL 
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

        INSERT  INTO saArtCompuestoGen
                ( gene_num, fecha, co_art, Co_Uni, tasa, co_mone, dis_cen, total_art, stotal_art, costo_tot, co_alma,
                  gene_art, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in,
                  fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe, sco_uni )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sGene_Num, @sdFecha, @sCo_Art, @sCo_Uni, @deTasa, @sCo_Mone, @sDis_Cen, @deTotal_Art, @deSTotal_Art,
                  @deCosto_Tot, @sCo_Alma, @bGene_Art, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sRevisado, @sTrasnfe, @sSCo_Uni )

        DECLARE @dtFe_In DATETIME
        D
```
