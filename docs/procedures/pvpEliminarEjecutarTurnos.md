# SP: pvpEliminarEjecutarTurnos
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarEjecutarTurnos
*DESCRIPCIÓN	: Elimina los turnos de la tabla pvTurnoExe
*AUTOR			: SOFTECH SISTEMAS.
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpEliminarEjecutarTurnos]
    (
      @sNum_Turno VARCHAR(20) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
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
            pvTurnoExe
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Num_Turno = @sNum_Turno
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
                    @sTablaOri = 'pvTurnoExe', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sNum_Turno
            END
    END
```
