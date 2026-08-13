# SP: pEliminarRenglonesTipoSerie
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarRenglonesTipoSerie
*DESCRIPCIÓN	: Elimina un registro en la tabla saSerie
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesTipoSerie]
    (
      @sCo_Tipo_SerieOri CHAR(6) ,
      @iReng_NumOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saSerie
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_serie = @sCo_Tipo_SerieOri
            AND reng_num = @iReng_NumOri	
		
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
                    @sTablaOri = 'saSerie', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Tipo_SerieOri
            END
	
    END
```
