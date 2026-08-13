# SP: pActualizarRenglonesCompuesto
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesCompuesto]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS (19-08-2009)
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesCompuesto]
    (
      @sCo_ArtC CHAR(20) ,
      @sCo_ArtCOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @deTotal_Art DECIMAL(18, 5) ,
      @sSco_Uni CHAR(6) ,
      @deStotal_Art DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
		--@tsValidadorOri	TIMESTAMP
	
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
            saArtCompuestoReng
        SET co_artc = @sCo_ArtC, reng_num = @iReng_Num, co_art = @sCo_Art, co_uni = @sCo_Uni, total_art = @deTotal_Art,
            sco_uni = @sSco_Uni, stotal_art = @deStotal_Art, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_artc = @sCo_ArtCOri
            AND reng_num = @iReng_NumOri
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saArtCompuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos

		SELECT
            *
        FROM
            @TableTimestamp
    END
```
