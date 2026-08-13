# SP: pActualizarRenglonesResInventario
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesResInventario]
DESCRIPCION: Actualiza los renglones modificados de los Resultados del inventario
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesResInventario]
    (
      @sNum_ResInv CHAR(20) ,
      @sNum_ResInvOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @ssco_Uni CHAR(6) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deTotal_Art_Teo DECIMAL(18, 5) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art_Teo DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
	--@deCost_Unit_Om decimal(18,5),
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
            saResInventarioReng
        SET num_resinv = @sNum_ResInv, reng_num = @iReng_Num, co_art = @sCo_Art, total_art = @deTotal_Art,
            total_art_teo = @deTotal_Art_Teo, stotal_art = @deStotal_Art, stotal_art_teo = @deSTotal_Art_Teo,
            co_uni = @sCo_Uni, sco_uni = @sSco_Uni, cost_unit = @deCost_Unit, 
		--cost_unit_om  = @deCost_Unit_Om,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            num_resinv = @sNum_ResInvOri
            AND reng_num = @iReng_NumOri 
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saResInventarioReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquin
```
