# SP: pInsertarRenglonesCompuestoGen
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pInsertarRenglonesCompuestoGen
DESCRIPCION	: Inserta los registros de los renglones asociados a  saArtCompuestoGen
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesCompuestoGen]
    (
      @sGene_Num CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Art CHAR(30) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sCo_Uni CHAR(6) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @sSCo_Uni CHAR(6) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @sCo_Alma CHAR(6) ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @deCost_Unit_Om DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
    
        INSERT  INTO saArtCompuestoGenReng
                ( gene_num, reng_num, co_art, co_alma, co_uni, total_art, sco_uni, costo_adi1, costo_adi2, costo_adi3,
                  stotal_art, cost_unit, cost_unit_om, lote_asignado, dis_cen, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sGene_Num, @iReng_Num, @sCo_Art, @sCo_Alma, @sCo_Uni, @deTotal_Art, @sSCo_Uni, @deCosto_Adi1,
                  @deCosto_Adi2, @deCosto_Adi3, @deStotal_Art, @deCost_Unit, @deCost_Unit_Om, '0', @sDis_Cen, @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        EXEC [pCostoActualizarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'RGEN'

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Suc
```
