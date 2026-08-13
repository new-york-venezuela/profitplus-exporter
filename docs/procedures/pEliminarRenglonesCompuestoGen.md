# SP: pEliminarRenglonesCompuestoGen
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesRenglonesCompuestoGen
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesCompuestoGen]
    (
      @sGene_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
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
            saArtCompuestoGenReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            gene_num = @sGene_NumOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
		--Eliminar Historico de Costos
        EXEC [dbo].[pCostoEliminarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'GCOM'

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtCompuestoGenReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sGene_NumOri
            END
    END
```
