# SP: pEliminarAdiGrupo
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiGrupo`](../tables/saAdiGrupo.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarAdiGrupo
*DESCRIPCIÓN	: Elimina un grupo adicional
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-08-18
*************************************************************************/

CREATE PROCEDURE [pEliminarAdiGrupo]
    (
      @sCo_AdiGrupoOri CHAR(8) ,
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
            saAdiGrupo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_adigrupo = @sCo_AdiGrupoOri
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
                    @sTablaOri = 'saAdiGrupo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_AdiGrupoOri
            END
    END
```
