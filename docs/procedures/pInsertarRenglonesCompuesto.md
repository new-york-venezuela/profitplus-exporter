# SP: pInsertarRenglonesCompuesto
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesCompuesto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesCompuesto]
    (
      @sCo_ArtC CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @sSco_Uni CHAR(6) ,
      @deStotal_Art DECIMAL(18, 5) ,
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
	
    
        INSERT  INTO saArtCompuestoReng
                ( co_artc, reng_num, co_art, co_uni, total_art, sco_uni, stotal_art, co_us_in, co_sucu_in, fe_us_in,
                  co_us_mo, fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_ArtC, @iReng_Num, @sCo_Art, @sCo_Uni, @deTotal_Art, @sSco_Uni, @deStotal_Art, @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sCo_Us_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtCompuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_ArtC
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
