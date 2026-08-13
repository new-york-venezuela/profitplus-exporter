# SP: pEliminarProcedencia
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saProcedencia`](../tables/saProcedencia.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pEliminarProcedencia
*DESCRIPCIÓN	:	Elimina una procedencia
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pEliminarProcedencia]
    (
      @sCod_ProcOri CHAR(6) ,
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
            saProcedencia
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_proc = @sCod_ProcOri
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
                    @sTablaOri = 'saProcedencia', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCod_ProcOri
            END
    END
```
