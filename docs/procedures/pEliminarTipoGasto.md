# SP: pEliminarTipoGasto
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoGasto`](../tables/saTipoGasto.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTipoGasto
*DESCRIPCIÓN	: Elimina un Tipo de Gasto
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarTipoGasto]
	(
      @sCo_GastoOri CHAR(4),
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
            saTipoGasto
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_gasto = @sCo_GastoOri
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
                    @sTablaOri = 'saTipoGasto', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_GastoOri
            END
    END
```
