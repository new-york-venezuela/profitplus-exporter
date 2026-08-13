# SP: pEliminarRenglonesArtUbicacion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtUbicacion`](../tables/saArtUbicacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesArtUbicacion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
FECHA: 30/05/2016
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesArtUbicacion]
    (
      @iRENG_NUMOri INT ,
      @sCo_ArtOri CHAR(30) ,
      @sCo_AlmaOri CHAR(6) ,
	  @sCo_UbicacionOri CHAR(6) ,
	  @sCo_Ubicacion2Ori CHAR(6) ,
	  @sCo_Ubicacion3Ori CHAR(6) ,
	  @iOrdenOri INT,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
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
              rowguid UNIQUEIDENTIFIER
            )
             
        DELETE FROM
            saArtUbicacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_alma = @sCo_AlmaOri
            AND co_ubicacion = @sCo_UbicacionOri
            AND co_ubicacion2_calculado = @sCo_Ubicacion2Ori
			AND co_ubicacion3_calculado = @sCo_Ubicacion3Ori
			AND orden = @iOrdenOri
             
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             -- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtUbicacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ArtOri

    END
```
