# SP: pEliminarTransporte
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarTransporte
*DESCRIPCIÓN	: Elimina un transporte
*AUTOR			: SOFTECH SISTEMAS 
*************************************************************************/

CREATE PROCEDURE [pEliminarTransporte]
    (
      @sCo_TranOri CHAR(6) ,
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
            saTransporte
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tran = @sCo_TranOri
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
                    @sTablaOri = 'saTransporte', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_TranOri
            END
    END
```
