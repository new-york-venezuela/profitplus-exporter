# SP: pObtenerListaArtCaracteristicaMov
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerListaArtCaracteristicaMov]
*DESCRIPCIÓN	: Sp que obtiene las llista de movimientos dado un tipo de documento y su
				  respectivo rowguid
*AUTOR			: SOFTECH SISTEMAS
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerListaArtCaracteristicaMov]
    (
      @gRowGuidDoc UNIQUEIDENTIFIER,
      @sTipoDoc    CHAR(4)
    )
AS 
    BEGIN	
		SELECT 
				co_lin01		AS		co_lin01, 
				co_lin02		AS		co_lin02,
				co_lin03		AS		co_lin03,
				co_lin04		AS		co_lin04,
				co_lin05		AS		co_lin05,
				co_subl01		AS		co_subl01,
				co_subl02		AS		co_subl02,
				co_subl03		AS		co_subl03,
				co_subl04		AS		co_subl04,
				co_subl05		AS		co_subl05,
				cantidad		AS		cantidad, 
				tipo_doc		AS		tipoDoc,
				rowguidDoc  	AS		rowguidDoc, 
				rowguid 		AS		rowguid
				
				FROM saArtCaracteristicaMov
					WHERE	rowguidDoc = @gRowGuidDoc AND
							tipo_doc = @sTipoDoc
    END
```
