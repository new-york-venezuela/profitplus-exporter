# SP: pEliminarTipoAnulacionVenta
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoAnulacionVenta`](../tables/saTipoAnulacionVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTipoAnulacionVenta
*DESCRIPCIÓN	: Elimina un Tipo de Anulacion Venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarTipoAnulacionVenta]
	(
      @sCo_AnulacionOri CHAR(4),
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
            saTipoAnulacionVenta
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_anulacion = @sCo_AnulacionOri
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
                    @sTablaOri = 'saTipoAnulacionVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_AnulacionOri
            END
    END
```
