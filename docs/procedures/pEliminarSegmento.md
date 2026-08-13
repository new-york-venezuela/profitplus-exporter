# SP: pEliminarSegmento
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saSegmento`](../tables/saSegmento.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pEliminarSegmento
*DESCRIPCIÓN	:	Elimina un registro en la tabla  segmento
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSegmento]
    (
      @sCo_SegOri CHAR(6) ,
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

        DELETE
            saSegmento
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_seg = @sCo_SegOri
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
                    @sTablaOri = 'saSegmento', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_SegOri
            END

    END
```
