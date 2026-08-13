# SP: pEliminarFactLoteGen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`stgFactLoteGen`](../tables/stgFactLoteGen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarFactLoteGen
*DESCRIPCIÓN	: Elimina un FactLoteGen
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarFactLoteGen]
    (
      @sCo_Fact_Lote_GenOri CHAR(6) ,
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
            stgFactLoteGen
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Fact_Lote_Gen = @sCo_Fact_Lote_GenOri
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
                    @sTablaOri = 'stgFactLoteGen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Fact_Lote_GenOri
            END
    END
```
