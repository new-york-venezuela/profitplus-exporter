# SP: pEliminarPuntoEmision
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPuntoEmision`](../tables/saPuntoEmision.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarPuntoEmision
*DESCRIPCIÓN	: Elimina un Punto de Emision
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarPuntoEmision]
	(
      @sCo_Punto_EmiOri CHAR(3) ,
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
            saPuntoEmision
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_punto_emi = @sCo_Punto_EmiOri
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
                    @sTablaOri = 'saPuntoEmision', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Punto_EmiOri
            END
    END
```
