# SP: pActualizarRenglonesTraslado
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesTraslado]
DESCRIPCION: Actualiza los renglones modificados de Traslado entre almacen
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
MODIFICADO EL: 18/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesTraslado]
    (
      @sTras_num CHAR(20) ,
      @sTras_NumOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
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
            saTrasladoReng
        SET tras_num = @sTras_Num, reng_num = @iReng_Num, co_art = @sCo_Art, total_art = @deTotal_Art,
            stotal_art = @deStotal_Art, co_uni = @sCo_Uni, sco_uni = @sSco_Uni, cost_unit = @deCost_Unit,
            dis_cen = @sDis_cen, costo_adi1 = @deCosto_Adi1, costo_adi2 = @deCosto_Adi2, costo_adi3 = @deCosto_Adi3,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            tras_num = @sTras_NumOri
            AND reng_num = @iReng_NumOri 
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	--Actualizar Costos
        EXEC [pCostoActualizarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'TRAS'	
        EXEC [pCostoActualizarSalida] @Row
```
