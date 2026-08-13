# SP: pEliminarTipoImagen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTipoImagen
*DESCRIPCIÓN	: Elimina un Tipo Imagen
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarTipoImagen]
    (
      @sCo_Tipo_ImagOri CHAR(6) ,
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
            saTipoImagen
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_imag = @sCo_Tipo_ImagOri
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
                    @sTablaOri = 'saTipoImagen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Tipo_ImagOri
            END
    END
```
