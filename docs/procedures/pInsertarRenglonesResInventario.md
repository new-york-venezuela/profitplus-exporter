# SP: pInsertarRenglonesResInventario
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesResInventario
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesResInventario]
    (
      @sNum_ResInv CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @sSco_Uni CHAR(6) ,
      @deTotal_Art_Teo DECIMAL(18, 5) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @deSTotal_Art_Teo DECIMAL(18, 5) ,
      @deCost_Unit DECIMAL(18, 5) ,
	--@deCost_Unit_Om decimal(18,5),
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

        INSERT  INTO saResInventarioReng
                ( num_resinv, reng_num, co_art, total_art, total_art_Teo, stotal_art, stotal_art_Teo, co_uni, sco_uni,
                  cost_unit, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sNum_ResInv, @iReng_Num, @sCo_Art, @deTotal_Art, @deTotal_Art_Teo, @deStotal_Art, @deSTotal_Art_Teo,
                  @sCo_Uni, @sSco_Uni, @deCost_Unit, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saResInventarioReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCampos
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
