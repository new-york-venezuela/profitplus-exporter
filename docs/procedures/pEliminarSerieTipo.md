# SP: pEliminarSerieTipo
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	pEliminarSerieTipo
-- DESCRIPCION	:	Elimina un registro en la tabla saSerieTipo
-- CREADO POR	:	SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [pEliminarSerieTipo]
    (
      @sCo_Tipo_SerieOri CHAR(6) ,
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
            saSerieTipo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_serie = @sCo_Tipo_SerieOri
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
                    @sTablaOri = 'saSerieTipo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Tipo_SerieOri
            END
    END
```
