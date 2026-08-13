# SP: pEliminarImpuesto
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuesto`](../tables/saImpuesto.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarImpuesto
*DESCRIPCIÓN	: Elimina un Impuesto
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarImpuesto]
    (
      @sCod_ImpuestoOri CHAR(6) ,
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
            saImpuesto
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_impuesto = @sCod_ImpuestoOri
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
                    @sTablaOri = 'saImpuesto', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCod_ImpuestoOri
            END
    END
```
