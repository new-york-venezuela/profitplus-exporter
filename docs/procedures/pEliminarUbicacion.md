# SP: pEliminarUbicacion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarUbicacion
*DESCRIPCIÓN	: Elimina una Ubicacion
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarUbicacion]
    (
      @sCo_UbicacionOri CHAR(6) ,
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
            saUbicacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_ubicacion = @sCo_UbicacionOri
            AND validador = @tsValidador	


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
                IF @rowGuidOri IS NOT NULL 
                    BEGIN
				-- Insertar Pista
                        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                            @sTablaOri = 'saUbicacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                            @sMaquina = @sMaquina, @sCampos = @sCo_UbicacionOri
                    END
            END

    END
```
