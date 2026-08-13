# SP: pActualizarRenglonesArtUbicacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtUbicacion`](../tables/saArtUbicacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarRenglonesArtUbicacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesArtUbicacion]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
	  @sCo_Alma CHAR(6) ,
      @sCo_AlmaOri CHAR(6) ,
	  @sCo_Ubicacion CHAR(6) ,
      @sCo_UbicacionOri CHAR(6) ,
	  @sCo_Ubicacion2 CHAR(6) ,
      @sCo_Ubicacion2Ori CHAR(6) ,
	  @sCo_Ubicacion3 CHAR(6) ,
      @sCo_Ubicacion3Ori CHAR(6) ,
	  @iOrden INT ,
	  @iOrdenOri INT ,
	  @sDes_Ubicacion VARCHAR(120) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	 
    )
AS 
    BEGIN
	
/**********Valores por defecto************/

IF @sCo_Ubicacion2Ori IS NULL
	SET @sCo_Ubicacion2Ori = 'NOTAPP'

IF @sCo_Ubicacion3Ori IS NULL
	SET @sCo_Ubicacion3Ori = 'NOTAPP'

/*****************************************/  
	
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saArtUbicacion
        SET co_art = @sCo_Art, co_alma = @sCo_Alma, co_ubicacion = @sCo_Ubicacion, co_ubicacion2 = @sCo_Ubicacion2,
			co_ubicacion3 = @sCo_Ubicacion3, des_ubicacion = @sDes_Ubicacion, orden = @iOrden, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
			fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_alma = @sCo_AlmaOri
            AND co_ubicacion = @sCo_UbicacionOri
			AND co_ubicacion2_calculado = @sCo_Ubicacion2Ori
			AND co_ubicacion3_calculado = @sCo_Ubicacion3Ori
			AND orden = @iOrdenOri
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        IF @dtFe_In IS NOT NULL
```
