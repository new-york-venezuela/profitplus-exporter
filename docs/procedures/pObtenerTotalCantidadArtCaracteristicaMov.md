# SP: pObtenerTotalCantidadArtCaracteristicaMov
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		[pObtenerTotalCantidadArtCaracteristicaMov]
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		Obtiene la cantidad total de articulos asignados 
						en la pantalla de combinaciones de lineas por sublinea
************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerTotalCantidadArtCaracteristicaMov]
    (
      @gRowGuidDoc UNIQUEIDENTIFIER
    )
AS 
    BEGIN

		SELECT ISNULL(SUM(cantidad),0) AS totalArt FROM saArtCaracteristicaMov 
			WHERE rowguidDoc = @gRowGuidDoc
	END
```
