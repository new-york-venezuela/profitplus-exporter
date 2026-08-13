# SP: pObtenerArtCaracteristicaMov
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerListaArtCaracteristicaMov]
*DESCRIPCIÓN	: Sp que obtiene las llista de movimientos dado un tipo de documento y su
				  respectivo rowguid
*AUTOR			: SOFTECH SISTEMAS
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerArtCaracteristicaMov]
     (
		@sCo_art CHAR(30) 
     )
AS 
    BEGIN	
    SELECT co_Art from savArtCaracteristica 
    WHERE co_Art = @sCo_art
    END
```
