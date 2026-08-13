# SP: pInsertarRenglonesTraslado
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesTraslado
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO EL: 18/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesTraslado]
    (
      @sTras_num CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Art CHAR(30) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deStotal_Art DECIMAL(18, 5) = NULL ,
      @sCo_Uni CHAR(6) ,
      @sSco_Uni CHAR(6) ,
      @deCost_Unit DECIMAL(18, 5) ,
      @sDis_cen VARCHAR(MAX) = NULL ,
      @deCosto_Adi1 DECIMAL(18, 5) ,
      @deCosto_Adi2 DECIMAL(18, 5) ,
      @deCosto_Adi3 DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saTrasladoReng
                ( tras_num, lote_asignado, reng_num, co_art, total_art, stotal_art, co_uni, sco_uni, cost_unit, dis_cen,
                  costo_adi1, costo_adi2, costo_adi3, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sTras_Num, '0', @iReng_Num, @sCo_Art, @deTotal_Art, @deStotal_Art, @sCo_Uni, @sSco_Uni, @deCost_Unit,
                  @sDis_cen, @deCosto_Adi1, @deCosto_Adi2, @deCosto_Adi3, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
	--Actualizar Costos 
	-- Primero se procesa los renglones de salida para que los entradas de temporal puedan tomar el valor 
	-- de esas salidas
        EXEC [pCostoActualizarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'TRAS'
        EXEC [pCostoActualizarEntrada] @RowGuid_Doc_Orig = @row
```
