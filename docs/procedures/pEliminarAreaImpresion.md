# SP: pEliminarAreaImpresion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saAreaImpresion`](../tables/saAreaImpresion.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarAreaImpresion
*DESCRIPCIÓN	: Elimina Area de Impresion
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarAreaImpresion]
	(
      @sCo_Area_ImpOri CHAR(3) ,
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
            saAreaImpresion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_area_imp = @sCo_Area_ImpOri
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
                    @sTablaOri = 'saAreaImpresion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Area_ImpOri
            END
    END
```
