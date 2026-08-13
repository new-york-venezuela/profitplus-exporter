# SP: pEliminarListaArtCaracteristica
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: [pEliminarListaArtCaracteristica]
*DESCRIPCIÓN	: Elimina un registro en la tabla ArtCaracteristica 
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pEliminarListaArtCaracteristica]
    (
		@sCo_art		CHAR(30) ,
	    @sCampo1		VARCHAR(60) = NULL ,
		@sCampo2		VARCHAR(60) = NULL ,
		@sCampo3		VARCHAR(60) = NULL ,
		@sCampo4		VARCHAR(60) = NULL ,
		@sCampo5		VARCHAR(60) = NULL ,
		@sCampo6		VARCHAR(60) = NULL ,
		@sCampo7		VARCHAR(60) = NULL ,
		@sCampo8		VARCHAR(60) = NULL ,
		@sCo_Us_In		CHAR(6) ,
		@sCo_Sucu_In	CHAR(6) ,
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6) ,
		@sMaquina		VARCHAR(60) = NULL --,
		
    )
AS 
    BEGIN
    
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
   
		DELETE  FROM saArtCaracteristica
		
		OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
            
           WHERE co_Art = @sCo_art
           
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
                    @sTablaOri = 'saArtCaracteristica', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_art
        END
 
    END
```
