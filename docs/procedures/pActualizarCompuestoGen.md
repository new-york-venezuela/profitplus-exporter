# SP: pActualizarCompuestoGen
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO: <2011-12-12>
MODIFICADO: <2020-07-27>
NOMBRE: pActualizarCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarCompuestoGen]
    (
      @sGene_Num CHAR(20) ,
      @sGene_NumOri CHAR(20) ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sdFecha SMALLDATETIME ,
      @deTasa DECIMAL(21, 8) ,
      @sCo_Mone CHAR(6) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art DECIMAL(18, 5) ,
      @deCosto_Tot DECIMAL(18, 5) ,
      @sCo_Alma CHAR(6) ,
      @bGene_Art BIT ,
	--@iSeriales_S	INT,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL,
	  @sSCo_Uni CHAR(6) = NULL   
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER ,
              gene_artOld BIT ,
              gene_artNew BIT
            )

        UPDATE
            saArtCompuestoGen
        SET gene_num = @sGene_Num, fecha = @sdFecha, co_art = @sCo_Art, co_uni = @sCo_Uni, tasa = @deTasa,
            co_mone = @sCo_Mone, dis_cen = @sDis_Cen, total_art = @deTotal_Art, stotal_art = @deSTotal_Art,
            costo_tot = @deCosto_Tot, co_alma = @sCo_Alma, gene_art = @bGene_Art,
		--seriales_s	=	@iSeriales_S,
            campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5,
            campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe, sco_uni = @sSCo_Uni
        OUTPUT
            Inserted.valid
```
