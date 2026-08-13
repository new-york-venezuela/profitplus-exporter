# SP: pEliminarConfigOrdenPago
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConfigOrdenPago`](../tables/saConfigOrdenPago.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarConfigOrdenPago
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla saConfigOrdenPago
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarConfigOrdenPago]
    (
      @sCo_ConfigOri CHAR(6) ,
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
            saConfigOrdenPago
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_config = @sCo_ConfigOri
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
                    @sTablaOri = 'saConfigOrdenPago', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ConfigOri
            END
    END
```
