# SP: pActualizarRenglonesCompuestoGen
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pActualizarRenglonesCompuestoGen
DESCRIPCION	: Actualiza los registros de los renglones asociados a  saArtCompuestoGen
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesCompuestoGen]
    (
      @sGene_Num CHAR(20) ,
      @sGene_NumOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Alma CHAR(6) ,
      @sCo_Uni CHAR(6) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @sSCo_Uni CHAR(6) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @deCost_Unit_Om DECIMAL(18, 5) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
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
            saArtCompuestoGenReng
        SET gene_num = @sGene_Num, reng_num = @iReng_Num, co_art = @sCo_Art, dis_cen = @sDis_Cen, co_uni = @sCo_Uni,
            total_art = @deTotal_Art, sco_uni = @sSCo_Uni, stotal_art = @deStotal_Art, cost_unit = @deCost_Unit,
            costo_adi1 = @deCosto_Adi1, costo_adi2 = @deCosto_Adi2, costo_adi3 = @deCosto_Adi3, co_alma = @sCo_Alma,
            cost_unit_om = @deCost_Unit_Om, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            gene_num = @sGene_NumOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        EXEC [pCostoActualizarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'GCOM'

	-- Inse
```
