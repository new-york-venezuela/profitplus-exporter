# SP: pEliminarRenglonesCompuesto
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesCompuesto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesCompuesto]
    (
      @sCo_ArtCOri CHAR(20) ,
      @iReng_NumOri INT ,
      @tsValidador TIMESTAMP = NULL ,
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
            saArtCompuestoReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_artc = @sCo_ArtCOri
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
                    @sTablaOri = 'saArtCompuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ArtCOri		  
            END
			  
    END
```
