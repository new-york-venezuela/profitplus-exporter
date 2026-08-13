# SP: pEliminarArtCrearAut
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCrearAut`](../tables/saArtCrearAut.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pEliminarArtCrearAut
*DESCRIPCIÓN	: Elimina una Plantilla para crear Artículos
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pEliminarArtCrearAut]
    (
      @sCo_ArtCrearAutOri CHAR(30) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saArtCrearAut
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_ArtCrearAut = @sCo_ArtCrearAutOri
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtCrearAut', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ArtCrearAutOri
            END
			
    END
```
