# SP: pvpEliminarTurno
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurno`](../tables/pvTurno.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarTurno
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla pvTurno
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpEliminarTurno]
    (
      @sCo_TurnoOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL,
      @sMaquina VARCHAR(60) = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            pvTurno
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_turno = @sCo_TurnoOri
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
                    @sTablaOri = 'pvTurno', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                     @sCampos = @sCo_TurnoOri
            END
    END
```
