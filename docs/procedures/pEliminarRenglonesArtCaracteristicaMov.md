# SP: pEliminarRenglonesArtCaracteristicaMov
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarRenglonesPrecioArticulo
*DESCRIPCIÓN	: Inserta un registro en la tabla ArtCaracteristicaMov cuando se da entrada
				  o salida una combinacion de sublineas a un articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pEliminarRenglonesArtCaracteristicaMov]
    (
		@gRowguid			UNIQUEIDENTIFIER,
		@iReng_NumOri		INT ,
		@sMaquina			VARCHAR(60)			=		NULL ,
		@sCo_Us_Mo			CHAR(6)				=		NULL ,
		@sCo_Sucu_Mo		CHAR(6)				=		NULL
    )
AS 
    BEGIN
		DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER 
            )
            
		DELETE FROM saArtCaracteristicaMov
		OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
          WHERE 
			   rowguid	=	@gRowguid	
			   
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
                    @sTablaOri = 'saArtCaracteristicaMov', @rowguidOri = @gRowguid, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @gRowguid
            END
    END
```
