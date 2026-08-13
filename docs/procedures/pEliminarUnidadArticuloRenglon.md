# SP: pEliminarUnidadArticuloRenglon
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarUnidadArticuloRenglon
*DESCRIPCIÓN	: Elimina una Unidad por un articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarUnidadArticuloRenglon]
    (
      @sCo_ArtOri CHAR(30) ,
      @sCo_UniOri CHAR(6) ,
      @iReng_NumOri INT ,
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
            saArtUnidad
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_uni = @sCo_UniOri		
			

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @sCamp VARCHAR(MAX)

        SET @sCamp = @sCo_ArtOri + ',' + @sCo_UniOri

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtUnidad', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCamp
            END
    END
```
