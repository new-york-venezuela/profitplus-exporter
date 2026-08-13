# SP: pEliminarCompuestoGen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarCompuestoGen]
    (
      @sGene_NumOri CHAR(20) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
	
	--ELIMINAR COSTOS HISTORICOS DE RENGLONES
        DECLARE @RengNum INT

        DECLARE Renglones_Cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                ACGR.[reng_num]
            FROM
                [saArtCompuestoGenReng] AS ACGR
            WHERE
                ACGR.gene_num = @sGene_NumOri
            ORDER BY
                reng_num

        OPEN Renglones_Cursor
        FETCH NEXT FROM Renglones_Cursor INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesCompuestoGen] @sGene_NumOri = @sGene_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor INTO @RengNum
            END	
        CLOSE Renglones_Cursor
        DEALLOCATE Renglones_Cursor	
	-- FIN ELIMINAR COSTOS
					

        DELETE FROM
            saArtCompuestoGen
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            gene_num = @sGene_NumOri
            AND validador = @tsValidador
	
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        EXEC [pCostoEliminarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'GCOM'

		-- Insertar Pista
        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtCompuestoGen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCam
```
