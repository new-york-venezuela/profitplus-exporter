# SP: pEliminarInventarioFisico
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarInventarioFisico
*DESCRIPCIÓN	: Elimina un Inventario Fisico
*AUTOR			: SOFTECH SISTEMAS 
*************************************************************************/

CREATE PROCEDURE [pEliminarInventarioFisico]
    (
      @sCo_InvFisicoOri CHAR(20) ,
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
            saInventarioFisico
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_invfisico = @sCo_InvFisicoOri
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
                    @sTablaOri = 'saInventarioFisico', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_InvFisicoOri
            END

    END
```
