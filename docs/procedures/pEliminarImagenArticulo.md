# SP: pEliminarImagenArticulo
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pEliminarImagenArticulo
*DESCRIPCIÓN	: Elimina la imagen de un articulo
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pEliminarImagenArticulo]
    (
      @sCo_ArtOri CHAR(30) ,
      @sTipOri CHAR(6) ,
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
            saArtImagen
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND tip = @sTipOri
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
                    @sTablaOri = 'saImagenArtic', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = sCo_ArtOri			
            END

    END
```
