# SP: pEliminarConsecutivo
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarConsecutivo
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla saTipoDocumento
*AUTOR			: SOFTECH SISTEMAS.
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarConsecutivo]
    (
      @sCo_Consecutivo_Ori CHAR(16) ,
      @tsValidador TIMESTAMP = NULL,
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
            saConsecutivo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_consecutivo = @sCo_Consecutivo_Ori
            --AND validador = @tsValidador		

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
                    @sTablaOri = 'saConsecutivo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Consecutivo_Ori
            END
    END
```
