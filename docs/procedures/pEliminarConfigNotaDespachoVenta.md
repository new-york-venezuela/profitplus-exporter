# SP: pEliminarConfigNotaDespachoVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saConfigNotaDespachoVenta`](../tables/saConfigNotaDespachoVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarConfigNotaDespachoVenta
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla saConfigNotaDespachoVenta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarConfigNotaDespachoVenta]
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
            saConfigNotaDespachoVenta
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
                    @sTablaOri = 'saConfigNotaDespachoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_ConfigOri
            END
    END
```
