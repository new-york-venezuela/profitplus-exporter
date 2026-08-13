# SP: pEliminarTipoComprobante
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTipoComprobante`](../tables/saTipoComprobante.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTipoComprobante
*DESCRIPCIÓN	: Elimina un Tipo de Comprobante
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarTipoComprobante]
	(
      @sCo_TipoOri CHAR(2) ,
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
            saTipoComprobante
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo = @sCo_TipoOri
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
                    @sTablaOri = 'saTipoComprobante', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_TipoOri
            END
    END
```
